#!/bin/bash
# HYTE Y70 Touch Web Dashboard - Startup Script
export DISPLAY=:0
DASHBOARD_DIR="/home/yaniss/dashboard"

# Wait for X display
while ! xdotool getactivewindow &>/dev/null 2>&1; do
    sleep 2
done
sleep 5

# Rotate HYTE screen to portrait
xrandr --output DP-0 --auto --right-of HDMI-0 --rotate right
sleep 2

# Disable screen blanking
xset s off
xset -dpms
xset s noblank

# Kill existing instances
pkill -f "uvicorn backend.main" 2>/dev/null
pkill -f "chromium.*8070" 2>/dev/null
sleep 1

# Start backend
cd "$DASHBOARD_DIR"
source venv/bin/activate
uvicorn backend.main:app --host 127.0.0.1 --port 8070 --log-level warning &
BACKEND_PID=$!
sleep 3

# Launch Chromium in kiosk mode on HYTE screen
chromium \
    --kiosk \
    --disable-gpu \
    --window-position=3840,0 \
    --window-size=1100,3840 \
    --no-first-run \
    --disable-translate \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --disable-features=TranslateUI \
    --noerrdialogs \
    --user-data-dir="$DASHBOARD_DIR/.chromium-data" \
    --app=http://127.0.0.1:8070 &

wait $BACKEND_PID
