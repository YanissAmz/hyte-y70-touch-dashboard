#!/bin/bash
# HYTE Y70 Touch Web Dashboard - Startup Script
export DISPLAY=:0
DASHBOARD_DIR="/home/yaniss/dashboard"

# Wait for X display
while ! DISPLAY=:0 xdpyinfo &>/dev/null 2>&1; do
    sleep 2
done
sleep 3

# Configure screens: adapt to TV being plugged in or not
if xrandr | grep -q "HDMI-0 connected"; then
    xrandr --output HDMI-0 --auto --primary \
           --output DP-0 --auto --right-of HDMI-0 --rotate right
else
    xrandr --output DP-0 --auto --rotate right --primary
fi
sleep 2

# Fix touch input rotation (ILITEK touchscreen doesn't auto-rotate with xrandr)
for name in "ILITEK       ILITEK-TOUCH" "ILITEK       ILITEK-TOUCH Mouse"; do
  xinput set-prop "$name" "Coordinate Transformation Matrix" 0 1 0 -1 0 1 0 0 1 2>/dev/null
done

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

# Re-apply touch matrix after GNOME settles (GNOME can reset it after login)
sleep 8
for name in "ILITEK       ILITEK-TOUCH" "ILITEK       ILITEK-TOUCH Mouse"; do
  DISPLAY=:0 xinput set-prop "$name" "Coordinate Transformation Matrix" 0 1 0 -1 0 1 0 0 1 2>/dev/null
done

wait $BACKEND_PID
