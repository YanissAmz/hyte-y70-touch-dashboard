# HYTE Y70 Touch Dashboard — Notes & Roadmap

## État actuel (2026-04-04)

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

## Config hardware

- **HYTE Y70 Touch** : DP-0 3840×1100, rotate right → 1100×3840
- **Touch** : ILITEK (USB 222a:0001), matrice xorg.conf.d + re-apply start.sh
- **LEDs** : OpenRGB port 6742, service systemd
- **GNOME** : scale 2, Xft.dpi=192, `zoom_level=0.5` dans webview

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
