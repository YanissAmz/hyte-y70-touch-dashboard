#!/bin/bash
# Turn on HYTE screen + restart web dashboard
export DISPLAY=:0
xrandr --output DP-0 --auto --right-of HDMI-0 --rotate right
sleep 2

# Restart dashboard if not running
if ! pgrep -f "uvicorn backend.main" >/dev/null; then
    /home/yaniss/dashboard/scripts/start.sh &
else
    # Just relaunch browser
    pkill -f "chromium.*8070" 2>/dev/null
    sleep 1
    chromium \
        --kiosk --disable-gpu \
        --window-position=3840,0 --window-size=1100,3840 \
        --no-first-run --disable-translate --disable-infobars \
        --noerrdialogs \
        --user-data-dir="/home/yaniss/dashboard/.chromium-data" \
        --app=http://127.0.0.1:8070 &
fi
echo "HYTE screen on"
