# HYTE Y70 Touch Dashboard — Notes & Roadmap

## Ce qui a été fait (2026-04-03 — initial)

### Backend (FastAPI + WebSocket)
- **8 collectors temps réel** : CPU (psutil + k10temp), RAM, GPU (pynvml natif), Disk (I/O + NVMe temp), Network (SSID/signal/ping/speeds/WiFi scan/Tailscale), Weather (wttr.in cache 15min), Processes (top CPU + GPU), Ollama (API localhost:11434), System Info (hostname/uptime/kernel/docker)
- **4 controllers REST** : LEDs (protocole serial GRB sur /dev/ttyACM0), Screen (xrandr on/off), Wallpaper (ImageMagick resize+darken), Services (ollama start/stop)
- **WebSocket /ws** : snapshot initial à la connexion + updates incrémentaux par type
- **Intervalles optimisés** : CPU/RAM 2s, GPU/Network 3s, Disk/System 30s, WiFi scan 60s, Weather 15min
- Port 8070, venv Python dans `venv/`

### Frontend (5 pages HTML/CSS/JS vanilla)
- **Page 1 — Dashboard** : header (heure glow + date + météo), cards CPU+RAM en grille 2 colonnes, GPU hero card avec barre VRAM, Storage+Network en grille, footer avec settings
- **Page 2 — Réseau** : détails connexion, ping sparkline, throughput graph, liste WiFi avec tap-to-connect
- **Page 3 — Processus** : top CPU, GPU processes, per-core view (16 cores), history charts CPU/GPU/RAM, Ollama status
- **Page 4 — Contrôles** : color wheel LED + presets, screen on/off, wallpaper gallery, service management
- **Page 5 — Système** : specs hardware, OS/kernel, disk I/O graph, temp history, Docker containers
- **Navigation** : scroll-snap, tap cards → page détaillée, dots indicator, home button, auto-retour 30s
- **Design** : glassmorphism, glow effects, badges colorés, icônes SVG, anti burn-in pixel-shift

### Affichage (webview.py)
- **GTK3 + WebKit2** au lieu de Chromium (GNOME bloque le positionnement Chromium entre écrans)
- `fullscreen_on_monitor()` pour cibler DP-0 spécifiquement
- `zoom_level=0.5` pour compenser le GNOME scale=2 (Xft.dpi=192)
- Hardware acceleration désactivée (préserve VRAM pour Ollama)

### Scripts
- `scripts/start.sh` — lance backend + Chromium kiosk (à migrer vers webview.py)
- `scripts/start_conky.sh` — fallback Conky (ancien start.sh)
- `scripts/screen_on.sh`, `screen_off.sh`, `monitor_screen.sh` — mis à jour
- `dashboard.service` — systemd user unit (à installer)

## Problèmes résolus

| Problème | Cause | Solution |
|----------|-------|----------|
| Chromium ne se positionne pas sur DP-0 | GNOME Mutter bloque les déplacements inter-écrans | GTK WebKit avec `fullscreen_on_monitor()` |
| Contenu trop zoomé sur HYTE | GNOME scale=2, Xft.dpi=192 | `webview.set_zoom_level(0.5)` |
| pynvml FutureWarning | Package pynvml deprecated | Installer nvidia-ml-py, import pynvml marche toujours |
| Chromium snap commande | `chromium-browser` introuvable | Commande = `chromium` (snap) |
| TV débranchée = écran cassé | HDMI-0 disconnected, DP-0 seul moniteur | Détecté, à gérer proprement au démarrage |

## Config hardware

- **Écran principal** : TV 4K HDMI-0 3840x2160 (pas toujours branchée)
- **HYTE Y70 Touch** : DP-0 3840x1100, rotate right → 1100x3840
- **GNOME** : scale factor 2, Xft.dpi=192
- **Coordonnées** : xdotool utilise pixels physiques, GNOME utilise logiques (÷2)

## TODO — Prochaines étapes

### BLOQUANT — Touch cassé
- [ ] **Le tactile ILITEK ne génère plus d'events X11** — `xinput test` ne reçoit rien quand on touche. Le device est listé (id 8/9), enabled, mais muet. Essayé : reset USB (`echo 0/1 > authorized`), reset xinput matrix → rien. Probablement besoin d'un reboot ou débranchement physique USB.
- [ ] Après fix touch : remettre la matrice xinput : `xinput set-prop "ILITEK       ILITEK-TOUCH" "Coordinate Transformation Matrix" 0 1 0 -1 0 1 0 0 1` (idem pour Mouse)

### Fait (2026-04-04)
- [x] Dual monitor : start.sh détecte HDMI-0 branché ou pas
- [x] Migré start.sh/screen_on.sh/monitor_screen.sh de Chromium vers webview.py
- [x] Layout Page 1 flex (remplit 3840px)
- [x] Wallpaper fond visible (current.png auto-généré, overlay réduit)
- [x] HiDPI canvas (devicePixelRatio dans charts.js)
- [x] Navigation horizontale (swipe gauche/droite, loop, dots en bas)
- [x] Systemd dashboard.service installé et enabled + linger
- [x] Mode nuit cron (23h off, 7h on)
- [x] screen.py gère HDMI-0 absent
- [x] xinput rotation matrix dans start.sh pour ILITEK touch

### À faire — LEDs
- [ ] **LEDs ne marchent PAS via /dev/ttyACM0** — ce device (USB 3402:0c00) est le contrôleur ÉCRAN, pas LED. Protocole écran : `FF CC 01 [on/off] [brightness 0-100]`. Les LED strips sont sur header ARGB carte mère → utiliser **OpenRGB** (`sudo apt install openrgb`)
- [ ] Intégrer OpenRGB dans le backend (API CLI ou SDK Python)
- [ ] Remplacer le controller leds.py par des appels OpenRGB
- [ ] Ajouter contrôle luminosité écran via protocole `FF CC 01`

### À faire — Fonctionnalités
- [ ] **Mode bureau** : bouton pour minimiser le webview → accès desktop Ubuntu sur le HYTE, retour auto après inactivité
- [ ] Navigateur/apps : fichiers JS existent (browser.js, launcher.js, keyboard.js) mais retirés du HTML pour simplifier. Remettre quand le mode bureau sera en place — le HYTE comme écran secondaire normal est plus flexible qu'un navigateur intégré
- [ ] **Widgets** : notifications, calendrier, musique en cours

### Polish
- [ ] Animations de transition entre pages plus fluides
- [ ] Graphes sparkline avec plus de style (gradient fill, points)
- [ ] Feedback tactile visuel sur les cards (ripple effect)
- [ ] Thèmes (dark/light/custom)
