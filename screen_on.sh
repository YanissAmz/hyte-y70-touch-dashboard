#!/bin/bash
# Turn on HYTE screen + restart dashboard
export DISPLAY=:0
xrandr --output DP-0 --auto --right-of HDMI-0 --rotate right
sleep 2
killall conky 2>/dev/null
sleep 1
conky -c ~/dashboard/conkyrc -d
sleep 3
xdotool search --name conky windowmove 3840 0 windowsize 1100 3840
echo "HYTE screen on"
