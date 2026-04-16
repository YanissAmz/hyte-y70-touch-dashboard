# HYTE Dashboard v2

Version 2 of the HYTE Y70 Touch dashboard — modern stack (SolidJS + Vite + TS + TailwindCSS v4), live ambilight-reactive ambient page, game center, touch-first swipe navigation, 3 swappable themes.

## Architecture

```
HDMI (TV, nvidia)               DisplayPort-0 (HYTE 1100×3840, amdgpu iGPU)
       │                                  │
       └────── X :0 (GNOME) ─────────────┘
                    │
                    │ override_redirect fullscreen window @ (3840, 0) 1100×3840
                    │
                    ▼
              WebKit2 (webview.py)
                    │
                    ▼ http://127.0.0.1:8070/v2/
              FastAPI backend
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
   WebSocket /ws          /api/games
  (collectors)            /api/wallpapers
  cpu, gpu, memory,       /api/leds /api/screen
  disk, network, wifi_scan  /api/power /api/volume
  weather, processes,      /api/bluetooth /api/launch
  system, ollama,
  notifications, ambilight ← /tmp/ambilight-color (shared)
                                  ▲
                                  │
                    ambilight-sync.service
                    (writes every TV frame)
                           │
                           ▼
                     LEDs boîtier (OpenRGB)
                     Hue (Entertainment DTLS)
                     Govee (LAN)
                     HYTE ambient page (this repo)
```

## Stack

- **Frontend** (`frontend-v2/`): SolidJS 1.9 + Vite 6 + TypeScript 5.6 strict + TailwindCSS v4
- **Backend** (`backend/`): FastAPI + asyncio scheduler, Python 3.13 venv
- **Webview** (`scripts/webview.py`): GTK3 + WebKit2 4.1 with `override_redirect` to bypass GNOME WM
- **Watchdog** (`monitor_screen.sh`): geometry-based detection, keeps backend + webview alive

## Pages (in swipe-scroll order)

1. **Main** — clock, weather, CPU/RAM/GPU/disk gauges, network summary
2. **Games** — 10 auto-detected game tiles, tap to launch on TV
3. **Network** — SSID, signal, IPs, ping/throughput sparklines, WiFi scan
4. **Processes** — top CPU/GPU VRAM, per-core bars, history sparklines
5. **Sysinfo** — hardware, OS, kernel, uptime, Docker, Ollama status
6. **Controls** — LEDs (effects + presets + wheel), brightness, power profile, wallpapers, desktop mode
7. **Settings** — theme selector (A/B/C), volume, Bluetooth, reload
8. **Launcher** — 6 native apps + 9 web shortcuts
9. **Browser** — URL/search input → routes to webview
10. **Ambient** — reactive wallpaper with ambilight color overlays (auto-display after 2 min idle)

Dev routes: `/v2/#design` (component showcase), `/v2/#debug` (raw WS dump).

## Services (systemd --user)

- `hyte-backend.service` — uvicorn on 127.0.0.1:8070
- `hyte-dashboard.service` — `monitor_screen.sh` watchdog (DISPLAY=:0)
- `hyte-xserver.service` — **DISABLED** (legacy, was pinned to nvidia DP-0)

System service:
- `ambilight-sync.service` — unified Hue + OpenRGB + Govee sync. Writes `/tmp/ambilight-color` which the backend's ambilight collector reads.

## Development

```bash
# Frontend dev with HMR + API proxy
cd frontend-v2 && npm run dev  # http://127.0.0.1:5173/v2/

# Frontend prod build (dist/ is served at /v2/)
cd frontend-v2 && npm run build

# Backend dev
cd /home/yaniss/projects/dashboard
source venv/bin/activate
uvicorn backend.main:app --host 127.0.0.1 --port 8070 --reload

# Webview
python3 scripts/webview.py
```

## Theming

Three themes live in `frontend-v2/src/styles/tokens.css`. Swap via the Settings page or programmatically:

```ts
import { setTheme } from "~/stores/theme";
setTheme("b");  // "a" | "b" | "c"
```

Theme is persisted in `localStorage["hyte-v2-theme"]`.

## Adding a game

Drop a `.desktop` file in `~/Bureau/` or `~/.local/share/applications/` with:

```
[Desktop Entry]
Type=Application
Name=Your Game
Exec=/path/to/launcher.sh
Icon=/home/yaniss/.local/share/icons/game-launchers/yourgame.png
```

The Game Center will pick it up on next page load (no restart needed).
