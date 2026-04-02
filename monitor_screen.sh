#!/bin/bash
# Watch for DP-0 rotation resets and restore the dashboard automatically.
# Runs as a user systemd service.

export DISPLAY=:0

while true; do
    # Check if DP-0 is connected but NOT rotated (3840x1100 instead of 1100x3840)
    current=$(xrandr --query 2>/dev/null | grep "^DP-0 connected" | grep -oP '\d+x\d+')
    if [ "$current" = "3840x1100" ]; then
        logger -t hyte-dashboard "DP-0 rotation lost, restoring..."
        xrandr --output DP-0 --auto --right-of HDMI-0 --rotate right
        sleep 2
        killall conky 2>/dev/null
        sleep 1
        conky -c ~/dashboard/conkyrc -d
        sleep 4
        xdotool search --name conky windowmove 3840 0 windowsize 1100 3840
        logger -t hyte-dashboard "Dashboard restored"
    fi
    sleep 30
done
