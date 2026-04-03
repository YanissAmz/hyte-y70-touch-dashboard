# HYTE Y70 Touch Dashboard — Notes & Roadmap

## Ce qui a été fait (2026-04-03)

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

### Priorité haute
- [ ] Tester avec TV HDMI-0 rebranchée (dual monitor)
- [ ] Migrer `scripts/start.sh` pour utiliser `webview.py` au lieu de Chromium
- [ ] Ajuster design Page 1 : spacing, tailles des éléments pour 1100x3840
- [ ] Vérifier rendu de toutes les pages (réseau, processus, contrôles, système)
- [ ] Wallpaper visible en fond (actuellement fond noir)
- [ ] Installer `dashboard.service` systemd pour autostart

### Fonctionnalités à ajouter
- [ ] **Mode navigateur** : swipe-down depuis le haut → barre URL, back/forward, le HYTE devient un vrai browser
- [ ] **Bouton Home flottant** : toujours visible, retour au dashboard
- [ ] **Clavier virtuel** : `onboard` ou intégré, pour taper des URLs/passwords sur le tactile
- [ ] **Lanceur d'apps** : page avec raccourcis (YouTube, Spotify, Grafana, etc.)
- [ ] **Mode nuit** : cron pour éteindre l'écran la nuit, rallumer le matin
- [ ] **Widgets** : notifications, calendrier, musique en cours
- [ ] **Swipe horizontal** entre dashboard et navigateur

### Polish
- [ ] Animations de transition entre pages plus fluides
- [ ] Graphes sparkline avec plus de style (gradient fill, points)
- [ ] Indicateurs de connexion WiFi animés
- [ ] Feedback tactile visuel sur les cards (ripple effect)
- [ ] Thèmes (dark/light/custom)
- [ ] Export/import de la config
