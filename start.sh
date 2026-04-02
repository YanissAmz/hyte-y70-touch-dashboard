#!/bin/bash
export DISPLAY=:0

# Wait for X display to be ready
while ! xdotool getactivewindow &>/dev/null; do
    sleep 2
done
sleep 5

# Rotate HYTE screen and position it
xrandr --output DP-0 --auto --right-of HDMI-0 --rotate right
sleep 2

# Disable screen blanking
xset s off
xset -dpms
xset s noblank

# Kill any existing conky
killall conky 2>/dev/null
sleep 1

# Launch conky
conky -c ~/dashboard/conkyrc -d

# Wait for window to appear then position it
sleep 4
xdotool search --name conky windowmove 3840 0 windowsize 1100 3840

