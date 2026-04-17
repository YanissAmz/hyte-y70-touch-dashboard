#!/bin/bash
# Post-start configuration for Xorg :1 (HYTE panel only, amdgpu).
# - Rotates DisplayPort-3 from native 3840x1100 landscape to 1100x3840 portrait.
# - Maps ILITEK touch devices to the rotated output with an identity matrix.
# - No HDMI/PRIME logic here — :1 only contains the HYTE, GNOME runs on :0.
#
# Idempotent. Called by hyte-xserver.service ExecStartPost.

set -u
export DISPLAY="${DISPLAY:-:1}"
export XAUTHORITY="${XAUTHORITY:-/run/user/1000/gdm/Xauthority}"

HYTE_OUTPUT="DisplayPort-3"

# Wait for Xorg to fully come up (xrandr answers).
for _ in $(seq 1 20); do
    if xrandr --query >/dev/null 2>&1; then break; fi
    sleep 0.25
done

xrandr --output "$HYTE_OUTPUT" --auto --rotate right 2>/dev/null || true

for id in $(xinput list --id-only 2>/dev/null); do
    name=$(xinput list --name-only "$id" 2>/dev/null)
    case "$name" in
        *ILITEK*ILITEK-TOUCH*)
            xinput set-prop "$id" "libinput Calibration Matrix" 1 0 0 0 1 0 0 0 1 2>/dev/null || true
            xinput --map-to-output "$id" "$HYTE_OUTPUT" 2>/dev/null || true
            ;;
    esac
done

xset s off 2>/dev/null || true
xset -dpms 2>/dev/null || true
xset s noblank 2>/dev/null || true

echo "configured :1 $HYTE_OUTPUT portrait + ILITEK mapped"
