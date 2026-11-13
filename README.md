# HYTE Y70 Touch Dashboard for Linux

The **HYTE Y70 Touch** is a PC case with a built-in 3840×1100 touchscreen.
On Windows, [HYTE Nexus](https://hyte.com/nexus) covers it. On Linux,
**nothing did** — until this repo. Modern stack, touch-first navigation,
ten swipeable pages of monitoring + media + automation, and 700 reverse-
engineered LED commands.

> 📸 _Demo video and dashboard photos coming — slots reserved in the [Demo](#demo) section._

---

## What you get

Ten pages, swipe-scrollable on touch, keyboard-friendly otherwise:

1. **Main** — clock, weather, CPU/RAM/GPU/disk gauges, network summary.
2. **Games** — auto-detects `.desktop` launchers, tap to launch on the TV.
3. **Network** — SSID, signal, IPs, ping/throughput sparklines, WiFi scan, virtual keyboard.
4. **Processes** — top CPU + GPU VRAM consumers, per-core bars, history sparklines.
5. **Sysinfo** — hardware, OS, kernel, uptime, Docker, Ollama status.
6. **Controls** — LEDs (effects + presets + colour wheel), brightness, power profile, wallpapers, desktop mode.
7. **Settings** — theme selector (3 swappable), volume, Bluetooth, reload.
8. **Launcher** — six native apps + nine web shortcuts.
9. **Browser** — URL/search input, routes to the WebKit2 viewer.
10. **Ambient** — reactive wallpaper with ambilight colour overlays (auto-engages after 2 min idle).

Plus a **dedicated Xorg :1 server** on the iGPU so GNOME/TV activity can't
bleed onto the panel, and a **`hyte-game-hook.sh`** wrapper that pauses
the dashboard while you launch a game so the iGPU doesn't compete.

---

## Demo

> 📸 Visuals coming. Slots reserved here for a captured set: panel-on-case
> photo, swipe through all 10 pages, ambient overlay catching real
> ambilight colours, and a before/after of a dashed-game launch.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend (`frontend-v2/`) | SolidJS 1.9 + Vite 6 + TypeScript 5.6 strict + TailwindCSS v4 |
| Backend (`backend/`) | FastAPI + asyncio scheduler, Python 3.13, served on `127.0.0.1:8070` |
| Webview (`scripts/webview.py`) | GTK3 + WebKit2 4.1, `override_redirect` to bypass GNOME WM |
| Watchdog (`scripts/monitor_screen.sh`) | Geometry-based detection, auto-recovers backend + webview |
| LED control (`scripts/hyte_leds.py`) | Reverse-engineered serial protocol over `/dev/ttyACM0` |

No Electron, no Node runtime in production — Vite builds a static bundle
served by FastAPI. The webview is a single 30-line GTK Python script.

---

## Architecture

```
HDMI (TV, NVIDIA dGPU)                   DisplayPort-3 (HYTE 1100×3840, amdgpu iGPU)
        │                                              │
        ▼                                              ▼
    X :0 (GNOME session)                        X :1 (isolated, single output)
    — no HYTE knowledge                         — no GNOME, only WebKit
                                                       │
                                                       │ override_redirect fullscreen
                                                       ▼
                                                 WebKit2 (webview.py)
                                                       │
                                                       ▼ http://127.0.0.1:8070/v2/
                                                 FastAPI backend
                                                       │
                                       ┌───────────────┴───────────────┐
                                       ▼                               ▼
                                 WebSocket /ws                       /api/...
                                  collectors                          games, wallpapers,
                                  (cpu, gpu, ram,                     leds, screen, power,
                                  disk, net, weather,                 volume, bluetooth,
                                  procs, system,                      launch
                                  ollama, ambilight)
                                       ▲
                                       │
                                  /tmp/ambilight-color
                                  (written by infra-home's
                                  ambilight-sync.service —
                                  read here, broadcast to
                                  the Ambient page)
```

Ambilight colour comes from the companion repo
[`infra-home`](https://github.com/YanissAmz/infra-home), which writes the
TV's currently-displayed dominant colour to `/tmp/ambilight-color`. This
dashboard's ambilight collector reads that file and pushes it to the
Ambient page overlay.

---

## Hardware

| Component | What I tested with |
|---|---|
| Case | HYTE Y70 Touch (3840×1100 panel, ILITEK touch) |
| CPU | AMD Ryzen 9 7950X (Raphael iGPU drives the panel) |
| dGPU | NVIDIA RTX 3090 (drives the TV via HDMI on X :0) |
| OS | Ubuntu 24.04, kernel 6.17.0-20-generic, Xorg 1.21.1.11 |

Different hardware should work as long as you have an **iGPU + dGPU split**
(or any second display path the WM doesn't claim). The README assumes the
dGPU drives your "main" display and the iGPU drives the HYTE panel — flip
that if your setup is reversed.

---

## Quick start

Prerequisites:

- Python 3.13 with the `venv` module. On Debian / Ubuntu it is a separate package: `sudo apt install python3-venv` (or `python3.13-venv`). Without it, `python3 -m venv` fails with "ensurepip is not available", and the next `pip install` then hits "externally-managed-environment".
- Node.js 20 or newer (Tailwind CSS 4 needs it). With Node 18 the frontend build fails with "Cannot find native binding". After upgrading Node, delete `frontend-v2/node_modules` and `frontend-v2/package-lock.json`, then run `npm install` again.

```bash
git clone https://github.com/YanissAmz/hyte-y70-touch-dashboard.git
cd hyte-y70-touch-dashboard

# Backend (Python 3.13)
python3 -m venv venv && source venv/bin/activate
pip install -r backend/requirements.txt

# Frontend
cd frontend-v2 && npm install && npm run build && cd ..

# Backend dev server (assumes the venv is active)
uvicorn backend.main:app --host 127.0.0.1 --port 8070 --reload

# Open the demo
xdg-open http://127.0.0.1:8070/v2/
```

For the dedicated X :1 setup (HYTE panel isolated from GNOME):

```bash
# Xorg server config
sudo cp scripts/xorg-hyte.conf /etc/X11/xorg-hyte.conf

# /etc/X11/Xwrapper.config must contain:
#   allowed_users=anybody
#   needs_root_rights=yes

# Systemd user services (paths inside the units assume the repo at $HOME/projects/hyte-y70-touch-dashboard):
systemctl --user enable --now hyte-backend.service hyte-xserver.service hyte-webview.service
```

Three system services run:

- `hyte-backend.service` — FastAPI + scheduler, `Restart=always`.
- `hyte-xserver.service` — Xorg :1 on the amdgpu iGPU, runs `scripts/configure-displays.sh` post-start (rotation + ILITEK touch mapping).
- `hyte-webview.service` — WebKit2 viewer with `DISPLAY=:1`, `Restart=on-failure`.

No polling watchdog, no `sleep` loops in the unit files. Hotplug on :1 is
a non-event because :1 owns a single physical output.

---

## Theming

Three themes live in `frontend-v2/src/styles/tokens.css`. Swap via the
Settings page or programmatically:

```ts
import { setTheme } from "~/stores/theme";
setTheme("b");  // "a" | "b" | "c"
```

Theme is persisted in `localStorage["hyte-v2-theme"]`. Theme A is the
neon-green default, B is warm, C is cold.

---

## Adding a game

Drop a `.desktop` file in `~/Bureau/` or `~/.local/share/applications/`:

```
[Desktop Entry]
Type=Application
Name=Your Game
Exec=/path/to/launcher.sh
Icon=/path/to/yourgame.png
```

The Game Center picks it up on next page load — no restart needed.

---

## LED control

`scripts/hyte_leds.py` controls the case LEDs over the `/dev/ttyACM0`
serial device using a protocol I reverse-engineered from the OpenRGB
captures (HYTE Nexus on Linux uses the same chip):

```bash
python3 scripts/hyte_leds.py off
python3 scripts/hyte_leds.py on
python3 scripts/hyte_leds.py color 255 0 128
python3 scripts/hyte_leds.py scan       # discover channels
```

> Note: you may need `sudo chmod 666 /dev/ttyACM0` once, or add a udev rule:
> `SUBSYSTEMS=="usb", ATTRS{idVendor}=="HYTE_VID", MODE="0666"`.

---

## Game mode

Game launchers in `~/bin/launch-*` and `~/Games/*/launch_*.sh` wrap their
exec with `hyte-game-hook.sh wrap …`. The hook stops `hyte-backend`,
`hyte-webview`, and `hyte-xserver` for the duration of the game and
brings them back on `EXIT`/`INT`/`TERM`. No pgrep watcher running, no
spurious wakeups.

---

## Upgrade checklist (Xorg/kernel)

After a kernel or Xorg upgrade, before relying on HYTE:

1. `systemctl --user restart hyte-xserver && journalctl --user -u hyte-xserver -n 30` — confirm `:1` came up cleanly on amdgpu.
2. `DISPLAY=:1 xinput list | grep ILITEK` — touch attached to master pointer.
3. Swipe through every page once, launch a test game, verify suspend/resume.

If `dpkg-reconfigure xserver-xorg-legacy` regenerates `/etc/X11/Xwrapper.config`,
re-apply `needs_root_rights=yes` (a non-root user service can't open a VT
otherwise).

---

## Legacy Conky version

Before the SolidJS rewrite, the dashboard was a Conky + Lua/Cairo build.
That version is preserved at the [`v1-conky` tag](https://github.com/YanissAmz/hyte-y70-touch-dashboard/releases/tag/v1-conky)
if you want the lighter setup with just circular gauges and no
backend/webview process. Stack: `conky-all`, `xdotool`, `xrandr`,
`imagemagick`. No Python venv, no Node, no systemd unit. Stops at
monitoring (no game center, no controls page, no LED UI).

---

## License

MIT — see [LICENSE](LICENSE).
