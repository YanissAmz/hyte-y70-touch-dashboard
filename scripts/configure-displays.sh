#!/bin/bash
# Post-start configuration for Xorg :1 (HYTE panel only, amdgpu).
# - Rotates the connected HYTE DisplayPort output from native 3840x1100
#   landscape to 1100x3840 portrait.
# - Maps ILITEK touch devices to the rotated output with an identity matrix.
# - No HDMI/PRIME logic here — :1 only contains the HYTE, GNOME runs on :0.
#
# Idempotent. Called by hyte-xserver.service ExecStartPost.

set -u
export DISPLAY="${DISPLAY:-:1}"
export XAUTHORITY="${XAUTHORITY:-/run/user/1000/gdm/Xauthority}"

HYTE_OUTPUT="$(
    xrandr --query 2>/dev/null \
        | awk '$2 == "connected" && $1 ~ /^DisplayPort-/ { print $1; exit }'
)"

if [ -z "${HYTE_OUTPUT}" ]; then
    HYTE_OUTPUT="DisplayPort-0"
fi

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

# GDM/X :0 may still have the ILITEK touch attached until it restarts with the
# dedicated InputClass ignore rule. Disable it live there so touches stop
# driving the TV session immediately.
for name in \
    "ILITEK       ILITEK-TOUCH" \
    "ILITEK       ILITEK-TOUCH Mouse"
do
    for id in $(DISPLAY=:0 xinput list --id-only "$name" 2>/dev/null); do
        DISPLAY=:0 xinput set-prop "$id" "Device Enabled" 0 2>/dev/null || true
    done
done

# X :1 must not receive pointer events from the desktop mini-keyboard or the
# DualSense touchpad, otherwise interactions on the main desktop can click or
# navigate inside the HYTE dashboard.
for name in \
    "  mini keyboard Mouse" \
    "  mini keyboard" \
    "  mini keyboard Consumer Control" \
    "  mini keyboard System Control" \
    "DualSense Wireless Controller Touchpad"
do
    for id in $(xinput list --id-only "$name" 2>/dev/null); do
        xinput set-prop "$id" "Device Enabled" 0 2>/dev/null || true
    done
done

xset s off 2>/dev/null || true
xset -dpms 2>/dev/null || true
xset s noblank 2>/dev/null || true

echo "configured :1 $HYTE_OUTPUT portrait + ILITEK mapped; disabled desktop inputs on :1 and ILITEK on :0"
