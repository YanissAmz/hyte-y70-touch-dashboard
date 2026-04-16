#!/bin/bash
# hyte-x-init.sh — Init DP-0 on X :1 after Xorg starts
# Sets portrait rotation + maps ILITEK touch input.
# Called by hyte-xserver.service (ExecStartPost).

export DISPLAY=:1

# Wait for X :1 to be ready (up to 15s)
for i in $(seq 1 30); do
    xdpyinfo -display :1 &>/dev/null && break
    sleep 0.5
done

if ! xdpyinfo -display :1 &>/dev/null; then
    echo "[hyte-x-init] ERROR: X :1 never became ready" >&2
    exit 1
fi

# Apply portrait rotation to DP-0
xrandr --output DP-0 --auto --rotate right

# Map ILITEK touch to DP-0 (handles rotation + offset automatically)
for id in $(xinput list --id-only 2>/dev/null); do
    name=$(xinput list --name-only "$id" 2>/dev/null)
    case "$name" in
        *ILITEK*ILITEK-TOUCH*)
            xinput set-prop "$id" "libinput Calibration Matrix" 1 0 0 0 1 0 0 0 1 2>/dev/null
            xinput --map-to-output "$id" DP-0 2>/dev/null
            ;;
    esac
done

# Disable blanking on :1
xset s off
xset -dpms
xset s noblank

echo "[hyte-x-init] DP-0 ready on :1"
