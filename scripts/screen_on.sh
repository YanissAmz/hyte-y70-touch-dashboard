#!/bin/bash
# Turn on HYTE screen + restart web dashboard
export DISPLAY=:0

if xrandr | grep -q "HDMI-0 connected"; then
    xrandr --output DP-0 --auto --right-of HDMI-0 --rotate right
else
    xrandr --output DP-0 --auto --rotate right --primary
fi
sleep 2

# Restart dashboard if not running
if ! pgrep -f "uvicorn backend.main" >/dev/null; then
    /home/yaniss/dashboard/scripts/start.sh &
else
    # Just relaunch webview
    pkill -f "webview.py" 2>/dev/null
    sleep 1
    python3 /home/yaniss/dashboard/scripts/webview.py &
fi
echo "HYTE screen on"
