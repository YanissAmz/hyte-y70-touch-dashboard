#!/bin/bash
# HYTE Y70 Touch Web Dashboard - Startup Script
export DISPLAY=:0
DASHBOARD_DIR="/home/yaniss/dashboard"

# Wait for X display
while ! DISPLAY=:0 xdpyinfo &>/dev/null 2>&1; do
    sleep 2
done
sleep 3

# Configure screens : HDMI primary (pour que GNOME y mette son top bar + icônes système)
# + DP-0 rotate right à droite de HDMI. Le dashboard est pinné sur DP-0 via EWMH
# (_NET_WM_FULLSCREEN_MONITORS) dans webview.py → il reste sur HYTE même si HDMI est primary.
if xrandr | grep -q "HDMI-0 connected"; then
    xrandr --output HDMI-0 --auto --primary \
           --output DP-0 --auto --right-of HDMI-0 --rotate right
else
    xrandr --output HDMI-0 --off 2>/dev/null
    xrandr --output DP-0 --auto --rotate right --primary
fi
sleep 2

# Map ILITEK touch device to DP-0 output (handles rotation + multi-monitor offset automatically).
# IMPORTANT: xorg.conf.d/99-ilitek-touch.conf must NOT set CalibrationMatrix, else the two
# matrices compose and the touch is double-rotated.
_map_touch() {
    for id in $(xinput list --id-only 2>/dev/null); do
        name=$(xinput list --name-only "$id" 2>/dev/null)
        case "$name" in
            *ILITEK*ILITEK-TOUCH*)
                xinput set-prop "$id" "libinput Calibration Matrix" 1 0 0 0 1 0 0 0 1 2>/dev/null
                xinput --map-to-output "$id" DP-0 2>/dev/null
                ;;
        esac
    done
}
_map_touch

# Disable screen blanking
xset s off
xset -dpms
xset s noblank

# Démarrer le serveur OpenRGB si disponible (LEDs ARGB)
if command -v openrgb &>/dev/null; then
    if ! pgrep -x openrgb &>/dev/null; then
        openrgb --server --noautoconnect &>/dev/null &
        sleep 2
    fi
fi

# Kill existing instances
pkill -f "uvicorn backend.main" 2>/dev/null
pkill -f "webview.py" 2>/dev/null
pkill -f "float_button.py" 2>/dev/null
sleep 1

# Start backend
cd "$DASHBOARD_DIR"
source venv/bin/activate
uvicorn backend.main:app --host 127.0.0.1 --port 8070 --log-level warning &
BACKEND_PID=$!
sleep 3

# Launch WebKit fullscreen viewer on HYTE (système python3, pas le venv — gi est une lib système)
/usr/bin/python3 "$DASHBOARD_DIR/scripts/webview.py" &

# Re-apply touch mapping after GNOME settles (GNOME can reset it after login)
sleep 8
_map_touch

wait $BACKEND_PID
