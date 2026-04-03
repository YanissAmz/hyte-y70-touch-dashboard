#!/bin/bash
# Monitor HYTE screen rotation and auto-restore
export DISPLAY=:0

while true; do
    current=$(xrandr --query 2>/dev/null | grep "^DP-0 connected" | grep -oP '\d+x\d+')
    if [ "$current" = "3840x1100" ]; then
        logger -t hyte-dashboard "DP-0 rotation lost, restoring..."
        xrandr --output DP-0 --auto --right-of HDMI-0 --rotate right
        sleep 2
        pkill -f "chromium.*8070" 2>/dev/null
        sleep 1
        chromium \
            --kiosk --disable-gpu \
            --window-position=3840,0 --window-size=1100,3840 \
            --no-first-run --disable-translate --disable-infobars \
            --noerrdialogs \
            --user-data-dir="/home/yaniss/dashboard/.chromium-data" \
            --app=http://127.0.0.1:8070 &
        logger -t hyte-dashboard "Dashboard restored"
    fi
    sleep 30
done
