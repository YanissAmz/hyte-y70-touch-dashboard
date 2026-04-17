# HYTE Dashboard v2

Version 2 of the HYTE Y70 Touch dashboard — modern stack (SolidJS + Vite + TS + TailwindCSS v4), live ambilight-reactive ambient page, game center, touch-first swipe navigation, 3 swappable themes.

## Architecture

```
HDMI (TV, nvidia)                       DisplayPort-3 (HYTE 1100×3840, amdgpu iGPU)
       │                                              │
       │                                              │
       ▼                                              ▼
    X :0 (GNOME session)                  X :1 (isolated, single output)
    — no HYTE knowledge                   — no GNOME, only WebKit
                                                      │
                                                      │ override_redirect fullscreen
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

## System requirements (isolated X :1 setup)

The HYTE panel runs on a dedicated Xorg :1 server on the amdgpu iGPU so
GNOME/TV activity can't bleed onto it. This requires a few files outside
this repo. Documented here so the setup can be reproduced on a fresh
install or after a dist-upgrade.

**Tested with** — Ubuntu 24.04, kernel `6.17.0-20-generic`, Xorg
`1.21.1.11`, amdgpu driver at PCI `0000:16:00.0` (Raphael iGPU),
NVIDIA RTX 3090 at PCI `0000:01:00.0` driving the TV.

**`/etc/X11/xorg-hyte.conf`** — copied from `scripts/xorg-hyte.conf`:

```
sudo cp scripts/xorg-hyte.conf /etc/X11/xorg-hyte.conf
```

**`/etc/X11/Xwrapper.config`** — must contain:

```
allowed_users=anybody
needs_root_rights=yes
```

`needs_root_rights=yes` is required for a non-root systemd user service
to open a VT. If `dpkg-reconfigure xserver-xorg-legacy` ever regenerates
this file, re-apply this line (the file has a protective comment about
this).

**Systemd user services** — three active units:

- `hyte-backend.service` — FastAPI + scheduler (`Restart=always`)
- `hyte-xserver.service` — Xorg :1 on amdgpu + ExecStartPost runs
  `scripts/configure-displays.sh` (rotation + ILITEK touch mapping)
- `hyte-webview.service` — WebKit2 viewer with `DISPLAY=:1`
  (`Restart=on-failure`)

No polling watchdog, no `sleep` loops. Hotplug on :1 is a non-event
because :1 owns a single physical output.

**Game mode** — launchers in `~/bin/launch-*` and `~/Games/*/launch_*.sh`
wrap their exec with `hyte-game-hook.sh wrap …`. The hook stops
`hyte-backend`, `hyte-webview`, and `hyte-xserver` for the duration of
the game and brings them back on EXIT/INT/TERM. No pgrep watcher running.

**Ambilight source** — `/tmp/ambilight-color` is written by a separate
daemon from the `infra-home` repo (`ambilight_unified_sync.py`). This
dashboard's backend reads it via `backend/collectors/ambilight.py` and
broadcasts to the Ambient page overlays. If the file is missing or stale
(>30s), the overlays fade to a navy fallback.

## Upgrade checklist

After a kernel or Xorg upgrade, before relying on HYTE:

1. `systemctl --user restart hyte-xserver && journalctl --user -u hyte-xserver -n 30`
   — confirm :1 came up cleanly on amdgpu
2. `DISPLAY=:1 xinput list | grep ILITEK` — touch attached to master pointer
3. Swipe through every page once, launch a test game, verify suspend/resume
