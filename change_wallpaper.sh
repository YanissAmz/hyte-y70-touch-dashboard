#!/bin/bash
# Usage: ./change_wallpaper.sh image.jpg
if [ -z "$1" ]; then
    echo "Usage: $0 <image_file>"
    exit 1
fi
convert "$1" -resize 1100x3840^ -gravity center -extent 1100x3840 -brightness-contrast -40x-10 ~/dashboard/wallpaper.png
export DISPLAY=:0
killall -9 conky 2>/dev/null
sleep 1
conky -c ~/dashboard/conkyrc -d
sleep 3
xdotool search --name conky windowmove 3840 0 windowsize 1100 3840
echo "Wallpaper changed!"
