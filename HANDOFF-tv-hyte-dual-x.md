# Handoff — TV ↔ HYTE dual-X coexistence (NVIDIA + amdgpu)

Owner handing off: Claude (Opus 4.7) + Codex · Date: 2026-04-17 · Status: **RÉSOLU**

---

## Goal

Faire coexister **deux serveurs Xorg** sur la même machine :
- **Xorg :0** pilote la TV (Philips UHDTV 4K) via **NVIDIA RTX 3090** sur HDMI (sortie `HDMI-0`). Session GNOME, geré par GDM.
- **Xorg :1** pilote le **HYTE Y70 Touch** (panneau tactile 1100×3840 portrait) via **amdgpu iGPU** (Ryzen 7950X Raphael) sur DisplayPort (sortie `DisplayPort-3`). Session dashboard isolée.

**But de l'isolation :** éviter qu'un événement sur la TV (on/off, hotplug, lock screen, GNOME recomposition) affecte le HYTE dashboard.

**Contrainte critique :** quand l'utilisateur joue aux jeux gourmands (MK8 emulator, RDR2, etc.), le HYTE ne doit pas faire glitcher la TV ni consommer GPU NVIDIA — c'est pour ça qu'on a physiquement branché le HYTE sur le DisplayPort iGPU de la carte mère, pas sur la 3090.

---

## Hardware

- CPU/iGPU : AMD Ryzen 9 7950X (Raphael), iGPU `amdgpu` à `PCI 0000:16:00.0` (= PCI:22:0:0 en décimal)
- GPU : NVIDIA RTX 3090 à `PCI 0000:01:00.0` (= PCI:1:0:0)
- Écrans :
  - TV Philips 4K sur **HDMI NVIDIA** (sortie `HDMI-0` côté X :0, `card1-HDMI-A-1` côté kernel DRM)
  - HYTE Y70 Touch sur **DisplayPort iGPU** carte mère (sortie `DisplayPort-3` côté X :1, `card2-DP-6` côté kernel — le numéro varie par driver)
- Mapping DRM kernel :
  - `/dev/dri/card1` + `/dev/dri/renderD128` → NVIDIA (pci 01:00.0)
  - `/dev/dri/card2` + `/dev/dri/renderD129` → amdgpu (pci 16:00.0)

Vérifier : `ls -la /dev/dri/by-path/`.

---

## Résolution

Le faux bug “NVIDIA casse quand `:1` démarre” venait bien d’un **vol de VT actif**, mais le premier correctif (`chvt` de retour vers GDM) n’était qu’une demi-solution :
- il réparait la TV
- mais il **suspendait aussi les clients GTK/WebKit de `:1`**
- résultat pratique : HYTE noir, même si `xrandr :1` montrait encore `DisplayPort-3`

Correctif qui tient vraiment :
1. garder `Xorg :1` isolé sur amdgpu avec `-configdir xorg-hyte.d`
2. lancer `Xorg :1` avec **`-sharevts`**
3. ne plus faire de `chvt` post-start
4. arrêter le legacy `hyte-dashboard.service` qui relançait encore `webview.py` sur `DISPLAY=:0`

État final appliqué :
- `~/.config/systemd/user/hyte-xserver.service`
  - `ExecStart=/usr/bin/Xorg :1 vt8 -sharevts -config xorg-hyte.conf -configdir xorg-hyte.d -nolisten tcp -noreset`
  - plus de `restore-primary-vt.sh` en `ExecStartPost`
- `hyte-dashboard.service` stoppé
- `scripts/screen_on.sh` et `scripts/screen_off.sh` réalignés sur `hyte-xserver.service` + `hyte-webview.service`

Validation faite :
1. `systemctl --user restart hyte-xserver.service`
   - `fgconsole` reste sur le VT GDM (`tty2` ici)
   - `DISPLAY=:0 xrandr --output HDMI-0 --off && ... --auto` = OK
   - `nvidia-smi display_active` = `Enabled`
2. probe GTK sur `:1`
   - `DISPLAY=:1 python3 ... import Gtk` = OK avec `-sharevts`
   - avant `-sharevts`, l’import Gtk/Gdk gelait ou échouait
3. `systemctl --user restart hyte-webview.service`
   - `xwininfo -root -tree` sur `:1` montre maintenant une vraie fenêtre `HYTEDash`
   - `WebKitNetworkProcess` + `WebKitWebProcess` présents
4. le dashboard legacy sur la TV n’est plus piloté par `hyte-dashboard.service`

## État actuel

**Les deux X servers coexistent maintenant de façon stable sur la machine.**

Pattern validé :
1. `sudo systemctl restart gdm` → **TV OK**
2. `systemctl --user start hyte-xserver.service hyte-webview.service` → **HYTE OK** sans vol de VT visible
3. `DISPLAY=:0 xrandr` continue à accepter les reconfigurations de CRTCs
4. `DISPLAY=:1 xrandr` voit toujours `DisplayPort-3`

**On n’est plus dans un "soit l'un, soit l'autre".**

---

## Ce qui a été tenté (tout est en place actuellement, rollback doc ci-dessous)

### 1. Xwrapper autorisant Xorg à ouvrir une VT en non-root

Fichier : `/etc/X11/Xwrapper.config`
```
needs_root_rights=yes
```
Nécessaire parce que hyte-xserver tourne comme user-service systemd. Sinon `Cannot open virtual console 8`.

### 2. Config Xorg dédiée pour X :1 (amdgpu seul)

Fichier : `/etc/X11/xorg-hyte.conf` (source dans le repo : `scripts/xorg-hyte.conf`)
```
Section "ServerFlags"
    Option "AutoAddGPU"   "false"
    Option "DontVTSwitch" "true"
    Option "DontZap"      "true"
EndSection
Section "Device"
    Identifier "AMD-Hyte"
    Driver     "amdgpu"
    BusID      "PCI:22:0:0"
EndSection
Section "Monitor" ... Section "Screen" ... Section "ServerLayout" ...
```

### 3. Service systemd user pour X :1

Fichier : `/home/yaniss/.config/systemd/user/hyte-xserver.service`
```
ExecStart=/usr/bin/Xorg :1 vt8 -sharevts -config xorg-hyte.conf -configdir xorg-hyte.d -nolisten tcp -noreset
ExecStartPost=... attend :1 prêt, puis lance configure-displays.sh (rotate portrait + map ILITEK touch)
```

Le `-configdir xorg-hyte.d` (relatif, résolu en `/etc/X11/xorg-hyte.d/`) pointe sur un **répertoire vide** pour que X :1 **n'applique pas** le config de X :0 (`/etc/X11/xorg.conf.d/10-nvidia-only.conf`).
Note : Xorg exige que `-configdir` soit un chemin relatif quand lancé avec privilèges élevés.

### 4. Config Xorg pour X :0 forçant NVIDIA seul

Fichier : `/etc/X11/xorg.conf.d/10-nvidia-only.conf`
```
Section "ServerFlags"
    Option "AutoAddGPU" "false"
EndSection
Section "OutputClass"
    Identifier "amdgpu-ignore-on-X0"
    MatchDriver "amdgpu"
    Option     "Ignore" "true"
EndSection
Section "Device"
    Identifier "NVIDIA-X0"
    Driver     "nvidia"
    BusID      "PCI:1:0:0"
EndSection
Section "Screen" ... Section "ServerLayout" ...
```

**Observation empirique :** `Option "Ignore" "true"` sur OutputClass n'empêche PAS le DRM probe. X :0 continue à ouvrir `/dev/dri/card2` via `xfree86: Adding drm device (/dev/dri/card2)` puis `systemd-logind: got fd for /dev/dri/card2`. Voir `/var/log/Xorg.0.log` pendant une session active.

### 5. Udev rule retirant `seat` de card2

Fichier : `/etc/udev/rules.d/99-hyte-amdgpu-no-seat.rules`
```
ACTION=="add|change", SUBSYSTEM=="drm", KERNELS=="0000:16:00.0", KERNEL=="card*", \
    TAG-="seat", TAG-="master-of-seat", TAG-="uaccess"
```

**Résultat :** `udevadm info /sys/class/drm/card2` n'a plus `seat`/`master-of-seat`/`uaccess` dans `CURRENT_TAGS`. X :0 (via systemd-logind) **n'ouvre plus** `/dev/dri/card2` (confirmé par `sudo lsof -p <x0_pid> | grep dri/` : ne montre que `/dev/dri/card1` + `/dev/dri/renderD128`). Le render node `renderD129` reste accessible pour OpenGL/Vulkan.

### 6. Xwrapper déjà réglé

Déjà en place, cf. point 1.

---

## Le faux bug restant identifié pendant l'enquête

Même quand X :0 n'avait aucun fd sur amdgpu (card2), démarrer X :1 semblait casser la capacité de X :0 à reconfigurer ses CRTCs NVIDIA.

Preuve reproductible :

```bash
# 1. Reset complet
systemctl --user stop hyte-xserver.service hyte-webview.service
sudo systemctl restart gdm
sleep 12

# 2. État sain vérifiable
DISPLAY=:0 xrandr --output HDMI-0 --off   # → OK, pas d'erreur
DISPLAY=:0 xrandr --output HDMI-0 --auto --primary --pos 0x0  # → OK
nvidia-smi --query-gpu=display_active --format=csv,noheader  # → Enabled

# 3. Démarrage X :1
systemctl --user start hyte-xserver.service
sleep 3

# 4. Tant que vt8 reste actif, X :0 paraît "cassé"
DISPLAY=:0 xrandr --output HDMI-0 --off   # → xrandr: Configure crtc 0 failed / BadMatch
nvidia-smi --query-gpu=display_active --format=csv,noheader  # → Disabled

# 5. Dès qu'on rend le VT à GDM, X :0 redevient sain
sudo chvt 3   # ou 2 selon le VT GDM courant
DISPLAY=:0 xrandr --output HDMI-0 --off   # → OK
nvidia-smi --query-gpu=display_active --format=csv,noheader  # → Enabled
```

**Hypothèse corrigée :** le symptôme venait d’abord de la gestion **mono-seat / VT actif**, pas d’un bug NVIDIA `580.126.09`.

Le driver NVIDIA n’est pas entièrement blanchi pour tous les cas, mais il n’est plus nécessaire pour expliquer le pattern principal observé.

---

## Ce qu'on n'a PAS encore essayé

1. **Supprimer les cycles systemd user** autour de `graphical-session.target` (`PartOf=` sur `hyte-xserver` / `hyte-webview`) pour éviter les messages “ordering cycle” au stop/start.
2. **Remplacer le `sudo -n chvt` par une primitive moins couplée à sudoers** si on veut durcir la solution (ex: helper root dédié).
3. **Tester un reboot complet** comme validation finale longue durée, même si le scénario `restart gdm -> start hyte-*` est maintenant bon.

---

## Fichiers en place (état actuel, modifications persistantes)

| Path | Role | Créé/modifié |
|------|------|--------------|
| `/etc/X11/xorg-hyte.conf` | Config Xorg pour X :1 (amdgpu seul) | session antérieure |
| `/etc/X11/xorg-hyte.d/` | Configdir vide pour isoler X :1 des rules de X :0 | cette session |
| `/etc/X11/xorg.conf.d/10-nvidia-only.conf` | Force X :0 sur NVIDIA, amdgpu ignoré | cette session |
| `/etc/udev/rules.d/99-hyte-amdgpu-no-seat.rules` | Retire seat de card2 | cette session |
| `/etc/X11/Xwrapper.config` | `needs_root_rights=yes` | session antérieure |
| `/home/yaniss/.config/systemd/user/hyte-xserver.service` | X :1 user service | modifié cette session (configdir + sharevts) |
| `/home/yaniss/.config/systemd/user/hyte-webview.service` | GTK WebKit viewer sur X :1 | session antérieure |
| `/home/yaniss/.config/systemd/user/hyte-backend.service` | FastAPI dashboard | session antérieure |
| `/home/yaniss/projects/dashboard/scripts/restore-primary-vt.sh` | helper de debug, plus utilisé par le service final | cette session |

Backups de l'état avant cette session :
- `/home/yaniss/projects/dashboard/backups/xorg.conf.d.20260417-120954/` — snapshot de /etc/X11/xorg.conf.d/ avant modifications
- `/home/yaniss/projects/dashboard/backups/xrandr-X0-before.txt` — output xrandr initial

---

## Commandes de diagnostic utiles

```bash
# État des X servers
pgrep -fa Xorg

# Voir quels DRM devices sont ouverts par X :0
XORG0_PID=$(pgrep -fa Xorg | grep -v ":1" | awk '{print $1}' | head -1)
sudo lsof -p "$XORG0_PID" | grep -iE "dri/|nvidia"

# Voir X :1
DISPLAY=:1 xrandr | grep connected
DISPLAY=:1 xdpyinfo | head -5

# Voir X :0
DISPLAY=:0 xrandr --listmonitors
nvidia-smi --query-gpu=display_active --format=csv,noheader

# Logs
sudo tail -200 /var/log/Xorg.0.log   # session GDM
journalctl --user -u hyte-xserver.service -n 50
sudo dmesg | grep -iE "drm|amdgpu|nvidia" | tail -30

# Tags udev
udevadm info /sys/class/drm/card2 | grep CURRENT_TAGS
```

Backend port : **8070** (FastAPI, service `hyte-backend`). WS : `ws://localhost:8070/ws`.

---

## Rollback complet (retour à l'ancien setup — HYTE sur X :0 avec PRIME)

Si le prochain agent abandonne l'isolation X :1 et revient à un HYTE dans la session GNOME X :0 :

```bash
# 1. Désactiver X :1
systemctl --user stop hyte-xserver.service hyte-webview.service
systemctl --user disable hyte-xserver.service
# hyte-webview.service devra être modifié pour pointer DISPLAY=:0 au lieu de :1

# 2. Retirer les configs Xorg introduites cette session
sudo rm /etc/X11/xorg.conf.d/10-nvidia-only.conf
sudo rm /etc/udev/rules.d/99-hyte-amdgpu-no-seat.rules
sudo udevadm control --reload
sudo udevadm trigger --subsystem-match=drm --action=change

# 3. Restart GDM
sudo systemctl restart gdm

# 4. X :0 devrait retrouver le double output (HDMI-1-0 via PRIME + DP-3 direct amdgpu)
DISPLAY=:0 xrandr --listmonitors
```

Le `/etc/X11/xorg-hyte.conf` et le répertoire `/etc/X11/xorg-hyte.d/` ne sont utilisés que par `-config` et `-configdir` sur hyte-xserver — tu peux les laisser ou les supprimer, ils sont sans effet sur X :0.

---

## Constraints (non négociables pour l'utilisateur)

- **TV prioritaire** quand il faut choisir. Gaming doit être sans glitch sur 3090 HDMI.
- Isolation X :1 visait à protéger HYTE, pas casser TV. Si incompatible définitivement, HYTE peut retourner sur X :0 (accepter la régression TV off/on perturbant HYTE, et la traiter par un watcher de DPMS plutôt que par isolation système entière).
- Pas de dual-boot Windows pour diagnostiquer. Linux pur.

---

## Done when

- `sudo systemctl restart gdm && sleep 10 && systemctl --user start hyte-xserver.service hyte-webview.service && sleep 5` laisse **les deux écrans actifs en permanence** (TV + HYTE simultanément, image sur chaque).
- Un reboot complet (`sudo reboot`) retrouve automatiquement les deux écrans.
- Aucune intervention manuelle xrandr nécessaire post-boot.
- Lancer un jeu (`MK8 via hyte-game-hook.sh wrap ...`) stoppe HYTE proprement, relance à la fermeture, et laisse la TV stable tout du long.

Si impossible : documenter le driver/kernel combo qui trigger le bug, appliquer le rollback, et ouvrir un bug report amont.
