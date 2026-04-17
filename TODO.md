# HYTE Y70 Touch Dashboard — Notes & Roadmap

## État actuel (2026-04-05)

### Backend (FastAPI + WebSocket)
- **8 collectors temps réel** : CPU (psutil + k10temp), RAM, GPU (pynvml), Disk, Network (WiFi scan/Tailscale/ping), Weather, Processes, Ollama, System Info, Notifications (dbus-monitor)
- **Controllers REST** : LEDs (OpenRGB SDK), Screen (DPMS xset), Wallpaper, Services, WiFi connect, Desktop mode
- **Intervalles** : CPU 3s, RAM 4s, GPU 5s, Network 4s, Disk 60s, System 60s, WiFi 90s, Weather 15min, Ollama 30s
- **Chat Ollama** : `POST /api/ollama/chat` streaming SSE + `GET /api/ollama/models`
- Port 8070, venv Python dans `venv/`

### Frontend (7 pages HTML/CSS/JS vanilla)
- **Page 1** — Dashboard : heure, météo, CPU/RAM/GPU/Disk/Network, notifications
- **Page 2** — Réseau : détails, ping/throughput sparklines, WiFi scan + modal connect + clavier virtuel
- **Page 3** — Processus : top CPU, GPU processes, per-core (16), history charts, Ollama status
- **Page 4** — Contrôles : 9 effets LEDs, color wheel, 10 presets, screen on/off DPMS, slider luminosité, mode bureau, wallpaper gallery, services
- **Page 5** — Système : specs, OS/kernel, disk I/O, temp history, Docker
- **Page 6** — Apps : launcher 9 apps, barre URL → mode navigateur
- **Page 7** — AI Chat : interface Ollama streaming, sélecteur modèle, markdown, clear
- **Navigation** : swipe horizontal, dots, home button, auto-retour 30s
- **Touch** : ripple effect, clavier virtuel QWERTY, scroll dans les listes
- **Idle** : canvas redraws suspendus après 2 min sans interaction

### Affichage (webview.py)
- GTK3 + WebKit2, `zoom_level=0.5`, hardware acceleration `ALWAYS`
- Mode bureau + mode navigateur + bouton ⌂ flottant
- Signal file polling 1500ms

### LEDs (OpenRGB)
- 3 devices : Corsair Dominator ×2 (I2C), MSI MPG X670E (HID, 79 LEDs)
- 9 effets, 10 presets, color wheel
- **threading.Lock** sur toutes les opérations I2C → fin de la race condition RAM
- `set_mode("Direct")` systématique avant chaque couleur statique

## Problèmes résolus (session 2026-04-04)

| Problème | Cause | Solution |
|----------|-------|----------|
| WebKit CPU à 95% | `pixel-shift 240s infinite` + `wifi-pulse` + `glow-pulse` CSS | Suppression des animations infinies |
| GPU à 33% | `backdrop-filter: blur(12px)` × 14 + SVG `drop-shadow` | Supprimés, cards opaques |
| RAM LEDs désynchronisées | Race condition thread rainbow vs thread set_color sur I2C | `threading.Lock()` partagé |
| Screen on ne fonctionne pas | `xrandr --off` déconnecte X11 entièrement | Remplacé par DPMS (`xset dpms force off/on`) |
| RAM LEDs ignorent le `set_mode` | Check `active_mode != 0` fragile | Toujours `d.set_mode("Direct")` sans condition |
| WiFi modal bloqué (clavier disparaît) | `window.prompt()` non supporté WebKit GTK | Modal custom + `<input>` réel |

## Problèmes résolus (session 2026-04-05)

| Problème | Cause | Solution |
|----------|-------|----------|
| Touch décalé (clic enregistré à un autre endroit) | Double rotation : `CalibrationMatrix` libinput + `Coordinate Transformation Matrix` xinput composées | Suppression de `CalibrationMatrix` dans xorg.conf.d, utilisation de `xinput --map-to-output DP-0` uniquement |
| Swipe horizontal cassé | Conséquence du touch roté de 90° en trop → horizontal → vertical | Réglé avec le touch |
| Dashboard s'affichait sur la TV HDMI | `find_dp0_xrandr_index()` avait bug de précédence → retournait 0 (HDMI) | Fix parsing `xrandr --listmonitors` + DP-0 pinné via `_NET_WM_FULLSCREEN_MONITORS` EWMH |
| Touch décalé après débranchement TV | Matrice xinput figée pour config à 2 écrans | Watchdog `monitor_screen.sh` détecte hotplug HDMI + ré-applique `--map-to-output DP-0` |
| TV sans barre GNOME (juste wallpaper) | DP-0 était `--primary` → top bar caché sous le dashboard | HDMI `--primary` quand branché, dashboard reste sur DP-0 via EWMH pinning |
| Dashboard dézoomé avec TV 4K | `zoom_level=0.5` hardcodé, scale GNOME change en multi-écran | Calcul dynamique `zoom = 1.0 / monitor_scale_factor(DP-0)` |
| 2 sticks RAM Corsair désync entre elles sur rainbow/breathing | Collision SMBus I2C entre les 2 devices | 20 ms de settle time + retry entre chaque write I2C |
| Palette couleurs délavée (rouge=pastel) | Roue : gradient radial blanc→couleur ; presets : couleurs GitHub UI (pastels) | Roue hue pure sat 100% + 10 presets pleinement saturés |

## Config hardware

- **HYTE Y70 Touch** : DP-0 3840×1100, rotate right → 1100×3840
- **Touch** : ILITEK (USB 222a:0001), `xinput --map-to-output DP-0` (auto-rotation + multi-écran)
- **LEDs** : OpenRGB port 6742, service systemd, 20 ms settle I2C inter-device
- **GNOME** : scale 2 single-screen, webview `zoom_level = 1/scale` adaptatif
- **Multi-écran** : HDMI `--primary` quand branché, DP-0 à droite ; dashboard épinglé à DP-0 via EWMH

## TODO — Prochaines étapes

### À tester
- [ ] **Notifications dbus-monitor** — vérifier avec une vraie notification Ubuntu
- [ ] **Page AI Chat** — tester avec modèle llama3 chargé dans Ollama
- [ ] **Mode bureau** — end-to-end : bouton → minimize → desktop → ⌂ → retour

### À faire — Fonctionnalités
- [ ] **Musique** — contrôles playerctl/MPRIS : titre, artiste, play/pause/skip (Spotify, VLC)
- [ ] **Fond d'écran IA** — générer avec Stable Diffusion local (RTX 3090) sur commande
- [ ] **Thèmes** — accent color dynamique, dark/light

### Polish
- [ ] Retirer le debug overlay `dbg` définitivement si touch stable ✓ (déjà fait)
- [ ] Feedback border glow au tap sur les cards
- [ ] Graphes : axe Y avec labels valeurs

## Ideas — post-ambilight (2026-04-17)

- [ ] **Galerie wallpapers dans Controls** — scan `~/Wallpapers/`, vignettes, tap = apply + `bumpWallpaperVersion()`. Valorise les outpaintings à venir (Bakugo etc.). ~30min.
- [ ] **Night mode auto** — après 23h, dim intensity ambi × 0.5, bump body alphas × 1.2. Confort visuel TV lumineuse le soir. ~15min.
- [ ] **Toast notifications ambi-tintées** — notif WS (dbus déjà streamé) → toast prenant `--ambi-accent` + glow. Uniformise le look. ~45min.
- [ ] **Cold reboot smoke test** — vérifier que HYTE se relance seul sur X :1 après reboot complet.
- [ ] **MK8 launch test** — valider `hyte-game-hook.sh` stoppe les 3 services + resume clean après game close.
- [ ] **ComfyUI outpainting Bakugo** — session collaborative Kontext 2-pass (1100×2100 puis 1100×3840), prompt storm/ruins/MHA style. GPU libre requis.
- [ ] **Fine-tune ambi effects sur Bakugo** — une fois l'image retravaillée, ajuster vignette + glow + bandeaux pour isoler le perso.
