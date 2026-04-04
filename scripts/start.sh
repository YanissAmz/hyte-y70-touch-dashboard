#!/bin/bash
# HYTE Y70 Touch Web Dashboard - Startup Script
export DISPLAY=:0
DASHBOARD_DIR="/home/yaniss/dashboard"

# Wait for X display
while ! xdotool getactivewindow &>/dev/null 2>&1; do
    sleep 2
done
sleep 5

# Configure screens: adapt to TV being plugged in or not
if xrandr | grep -q "HDMI-0 connected"; then
    xrandr --output HDMI-0 --auto --primary \
           --output DP-0 --auto --right-of HDMI-0 --rotate right
else
    xrandr --output DP-0 --auto --rotate right --primary
fi
sleep 2

# Fix touch input rotation (ILITEK touchscreen doesn't auto-rotate)
for id in $(DISPLAY=:0 xinput list --id-only 2>/dev/null | while read i; do
  DISPLAY=:0 xinput list-props "$i" 2>/dev/null | grep -q "Coordinate Transformation" && echo "$i"
done); do
  xinput set-prop "$id" "Coordinate Transformation Matrix" 0 1 0 -1 0 1 0 0 1 2>/dev/null
done

# Disable screen blanking
xset s off
xset -dpms
xset s noblank

# Kill existing instances
pkill -f "uvicorn backend.main" 2>/dev/null
pkill -f "webview.py" 2>/dev/null
sleep 1

# Start backend
cd "$DASHBOARD_DIR"
source venv/bin/activate
uvicorn backend.main:app --host 127.0.0.1 --port 8070 --log-level warning &
BACKEND_PID=$!
sleep 3

# Launch WebKit fullscreen viewer on HYTE
python3 "$DASHBOARD_DIR/scripts/webview.py" &

wait $BACKEND_PID
