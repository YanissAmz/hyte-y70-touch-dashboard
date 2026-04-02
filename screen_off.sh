#!/bin/bash
# Turn off HYTE screen
export DISPLAY=:0
xrandr --output DP-0 --off
echo "HYTE screen off"
