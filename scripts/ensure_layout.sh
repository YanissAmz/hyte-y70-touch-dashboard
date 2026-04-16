#!/usr/bin/env bash
set -euo pipefail

export DISPLAY=:0
export XAUTHORITY=/run/user/1000/gdm/Xauthority

XRANDR="/usr/bin/xrandr"
SYSTEMCTL="/usr/bin/systemctl"

wait_for_x() {
    for _ in $(seq 1 30); do
        "$XRANDR" --query >/dev/null 2>&1 && return 0
        sleep 1
    done
    echo "[ensure_layout] X :0 indisponible" >&2
    return 1
}

wait_for_x

if ! "$XRANDR" --query | grep -q '^HDMI-0 connected'; then
    echo "[ensure_layout] HDMI-0 absent, rien a faire"
    exit 0
fi

if "$XRANDR" --query | grep -q '^DP-0 connected'; then
    "$XRANDR" \
        --output HDMI-0 --auto --primary \
        --output DP-0 --off
fi

# Lance l'X dédié HYTE via le service système (accès VT requis).
if command -v sudo >/dev/null 2>&1; then
    sudo -n "$SYSTEMCTL" start hyte-xserver.service >/dev/null 2>&1 || true
fi

exit 0
