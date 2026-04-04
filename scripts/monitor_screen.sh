#!/bin/bash
# Monitor HYTE screen rotation and auto-restore
export DISPLAY=:0

while true; do
    current=$(xrandr --query 2>/dev/null | grep "^DP-0 connected" | grep -oP '\d+x\d+')
    if [ "$current" = "3840x1100" ]; then
        logger -t hyte-dashboard "DP-0 rotation lost, restoring..."
        if xrandr | grep -q "HDMI-0 connected"; then
            xrandr --output DP-0 --auto --right-of HDMI-0 --rotate right
        else
            xrandr --output DP-0 --auto --rotate right --primary
        fi
        sleep 2
        pkill -f "webview.py" 2>/dev/null
        sleep 1
        python3 /home/yaniss/dashboard/scripts/webview.py &
        logger -t hyte-dashboard "Dashboard restored"
    fi
    sleep 30
done
