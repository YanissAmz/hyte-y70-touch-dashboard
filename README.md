# HYTE Y70 Touch Dashboard for Linux

A custom system monitoring dashboard for the [HYTE Y70 Touch](https://hyte.com/y70-touch) PC case's built-in touchscreen, running on Linux with Conky and Lua/Cairo.

Also includes a Python script to control the case LEDs via reverse-engineered serial protocol.

![Dashboard Preview](wallpaper_space.jpg)

## Features

- Real-time circular gauges for CPU, Memory, GPU, Storage, and Network
- NVIDIA GPU monitoring (utilization, temperature, power draw, VRAM)
- Weather display via [wttr.in](https://wttr.in)
- Customizable wallpaper with automatic darkening
- LED control script (reverse-engineered from OpenRGB)
- Screen on/off scripts for headless setups

## Hardware

- **Case**: HYTE Y70 Touch
- **Screen**: Built-in 3840x1100 display (used in portrait mode at 1100x3840)
- **Connection**: DisplayPort (DP-0)

Tested with:
- AMD Ryzen 9 7950X
- NVIDIA RTX 3090
- Ubuntu + GNOME

## Dependencies

```bash
sudo apt install conky-all xdotool xrandr imagemagick curl
```

For LED control:
```bash
pip install pyserial
```

## Installation

1. Clone the repository:
```bash
git clone https://github.com/YanissAmz/hyte-y70-touch-dashboard.git ~/dashboard
```

2. Set up the wallpaper (optional, uses included space theme by default):
```bash
./change_wallpaper.sh wallpaper_space.jpg
```

3. Start the dashboard:
```bash
./start.sh
```

4. (Optional) Enable autostart with GNOME — copy the provided desktop entry:
```bash
cp conky-dashboard.desktop ~/.config/autostart/
```

## Files

| File | Description |
|------|-------------|
| `conkyrc` | Conky configuration |
| `rings.lua` | Dashboard rendering (Lua/Cairo) — circular gauges, cards, text |
| `start.sh` | Startup script — rotates screen, disables blanking, launches Conky |
| `screen_on.sh` | Turn on the HYTE screen and restart the dashboard |
| `screen_off.sh` | Turn off the HYTE screen |
| `change_wallpaper.sh` | Change wallpaper with automatic resize and darkening |
| `gpu_util.sh` | Helper — GPU utilization query |
| `gpu_mem.sh` | Helper — GPU memory query |
| `hyte_leds.py` | LED control via serial (reverse-engineered protocol) |
| `conky-dashboard.desktop` | GNOME autostart entry |

## LED Control

Control the HYTE Y70 Touch case LEDs from the command line:

```bash
# Turn off all LEDs
python3 hyte_leds.py off

# Turn on (white)
python3 hyte_leds.py on

# Set custom color
python3 hyte_leds.py color 255 0 128

# Scan for connected LED channels
python3 hyte_leds.py scan
```

> Note: You may need to `sudo chmod 666 /dev/ttyACM0` for serial access, or add a udev rule.

## Customization

- **Colors**: Edit the color table in `rings.lua` (line ~137)
- **Layout**: Adjust card positions and sizes in `conky_draw_dashboard()`
- **Update interval**: Change `update_interval` in `conkyrc` (default: 2 seconds)
- **Network interface**: Replace `wlp13s0` in `rings.lua` with your interface name
- **Hostname**: The footer displays `yaniss-PC` — change in `rings.lua` footer section

## Troubleshooting

**Screen shows Ubuntu logo but no dashboard:**
The xrandr rotation may have been reset (e.g., after suspend/resume). Run:
```bash
./screen_on.sh
```

**Dashboard appears on wrong monitor:**
Check your display output name with `xrandr --query` and update `DP-0` references in `start.sh`, `screen_on.sh`, and `screen_off.sh`.

**Conky starts but window is mispositioned:**
Adjust the `windowmove` coordinates in `start.sh` to match your display layout.

## License

MIT
