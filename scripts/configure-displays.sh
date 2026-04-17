#!/bin/bash
# Event-driven display + touch configurator. Called once at login and on every
# D-Bus MonitorsChanged event. No polling loops anywhere.
#
# - Detects the HYTE panel by resolution (1100x3840 or 3840x1100) so the
#   connector name can drift (DP-0 / DisplayPort-0 / DisplayPort-3).
# - Detects first connected HDMI output (= TV).
# - Applies: HDMI primary + HYTE rotate right + right-of HDMI. If HDMI absent,
#   HYTE becomes primary.
# - Maps ILITEK touch devices to the HYTE output with an identity matrix.
#
# Idempotent: safe to call repeatedly. Returns 0 on success, 1 if no HYTE.

set -u
export DISPLAY="${DISPLAY:-:0}"

_detect_hyte() {
    xrandr --query 2>/dev/null | awk '
        / connected/ && !/disconnected/ { current=$1 }
        current && /^[[:space:]]+(1100x3840|3840x1100)[[:space:]]/ { print current; exit }
    '
}

_detect_hdmi() {
    xrandr --query 2>/dev/null | awk '
        /^HDMI[^[:space:]]* connected/ && !/disconnected/ { print $1; exit }
    '
}

hyte=$(_detect_hyte)
hdmi=$(_detect_hdmi)

if [ -z "$hyte" ]; then
    echo "hyte panel not detected" >&2
    exit 1
fi

if [ -n "$hdmi" ]; then
    xrandr --output "$hdmi" --auto --primary \
           --output "$hyte" --auto --rotate right --right-of "$hdmi" 2>/dev/null
else
    xrandr --output "$hyte" --auto --rotate right --primary 2>/dev/null
fi

# Map ILITEK touch to HYTE — calibration matrix reset to identity so xinput's
# --map-to-output is the single source of truth (xorg.conf.d must NOT set it).
for id in $(xinput list --id-only 2>/dev/null); do
    name=$(xinput list --name-only "$id" 2>/dev/null)
    case "$name" in
        *ILITEK*ILITEK-TOUCH*)
            xinput set-prop "$id" "libinput Calibration Matrix" 1 0 0 0 1 0 0 0 1 2>/dev/null || true
            xinput --map-to-output "$id" "$hyte" 2>/dev/null || true
            ;;
    esac
done

# Screen blanking off — GNOME sometimes resets this after monitor changes.
xset s off 2>/dev/null || true
xset -dpms 2>/dev/null || true
xset s noblank 2>/dev/null || true

echo "configured: hyte=$hyte hdmi=${hdmi:-none}"
