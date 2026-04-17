#!/bin/bash
# Watchdog : maintient le backend FastAPI + le webview GTK actifs sur le HYTE.
# Architecture unifiée DISPLAY=:0 (iGPU) — plus de X server isolé :1.
#
# Détection du connecteur HYTE par résolution (1100x3840 portrait) pour supporter
# amdgpu (iGPU: DisplayPort-0) et nvidia legacy (DP-0) sans hardcoding.

export DISPLAY=:0
DASHBOARD_DIR="/home/yaniss/projects/dashboard"
SUSPEND_FLAG="/tmp/hyte-dashboard-suspended"
GAME_LITE_FLAG="/tmp/hyte-dashboard-game-lite"

_detect_hyte_connector() {
    # Parse xrandr pour trouver la sortie connectée avec résolution 1100x3840 ou 3840x1100.
    xrandr --query 2>/dev/null | awk '
        / connected/ && !/disconnected/ { current=$1 }
        current && /^[[:space:]]+(1100x3840|3840x1100)[[:space:]]/ { print current; exit }
    '
}

_detect_hdmi_connector() {
    # Première sortie HDMI connectée (= TV).
    xrandr --query 2>/dev/null | awk '
        /^HDMI[^[:space:]]* connected/ && !/disconnected/ { print $1; exit }
    '
}

_configure_displays() {
    # Applique la config xrandr persistante : HDMI primary (GNOME top bar + dock y vont),
    # HYTE rotate right (panneau monté en portrait, panel natif est 3840x1100 landscape),
    # HYTE à droite de HDMI. Sans hardcoding du nom de connecteur — ça survit aux
    # changements amdgpu/nvidia (DP-0 → DisplayPort-3 → …).
    local hyte hdmi cur_w cur_h
    hyte=$(_detect_hyte_connector)
    hdmi=$(_detect_hdmi_connector)
    [ -z "$hyte" ] && return

    # Ne réappliquer que si la géométrie actuelle n'est pas déjà portrait (évite de
    # flasher l'écran à chaque restart de monitor_screen.sh).
    read -r cur_w cur_h <<<"$(xrandr --listmonitors 2>/dev/null | awk -v h="$hyte" '
        $NF == h { split($3, a, "[/x+]"); print a[1], a[3]; exit }
    ')"
    if [ "$cur_w" = "1100" ] && [ "$cur_h" = "3840" ] && [ -n "$hdmi" ]; then
        # Vérifier que HDMI est primary — sinon GNOME barre reste sur HYTE.
        if xrandr --listmonitors 2>/dev/null | grep -q "^ 0:.*\*$hdmi\b"; then
            return
        fi
    fi

    if [ -n "$hdmi" ]; then
        xrandr --output "$hdmi" --auto --primary \
               --output "$hyte" --auto --rotate right --right-of "$hdmi" 2>/dev/null
    else
        xrandr --output "$hyte" --auto --rotate right --primary 2>/dev/null
    fi
    sleep 1
}

_ensure_backend() {
    [ -f "$SUSPEND_FLAG" ] && return
    if ! pgrep -f "uvicorn backend.main:app" >/dev/null 2>&1; then
        cd "$DASHBOARD_DIR" || return
        nohup "$DASHBOARD_DIR/venv/bin/python" -m uvicorn backend.main:app \
            --host 127.0.0.1 --port 8070 --log-level warning >/tmp/hyte-uvicorn.log 2>&1 &
        sleep 2
    fi
}

_ensure_webview() {
    [ -f "$SUSPEND_FLAG" ] && return
    [ -f "$GAME_LITE_FLAG" ] && return
    if ! pgrep -f "webview.py" >/dev/null 2>&1; then
        nohup /usr/bin/python3 "$DASHBOARD_DIR/scripts/webview.py" >/tmp/hyte-webview.log 2>&1 &
        sleep 2
    fi
}

_map_touch() {
    local conn
    conn=$(_detect_hyte_connector)
    [ -z "$conn" ] && return
    for id in $(xinput list --id-only 2>/dev/null); do
        name=$(xinput list --name-only "$id" 2>/dev/null)
        case "$name" in
            *ILITEK*ILITEK-TOUCH*)
                xinput set-prop "$id" "libinput Calibration Matrix" 1 0 0 0 1 0 0 0 1 2>/dev/null
                xinput --map-to-output "$id" "$conn" 2>/dev/null
                ;;
        esac
    done
}

# Boot : config xrandr persistante + touch mapping + services
_configure_displays
_map_touch
_ensure_backend
_ensure_webview

# Loop : 30s (moins agressif que 10s — plus d'interférence gaming non plus depuis la séparation iGPU)
while true; do
    if [ -f "$SUSPEND_FLAG" ]; then
        pkill -f "webview.py" 2>/dev/null || true
        pkill -f "uvicorn backend.main:app" 2>/dev/null || true
        sleep 5
        continue
    fi

    if [ -f "$GAME_LITE_FLAG" ]; then
        _ensure_backend
        pkill -f "webview.py" 2>/dev/null || true
        sleep 5
        continue
    fi

    _ensure_backend
    _ensure_webview

    # Re-map touch périodiquement — GNOME peut le reset après hotplug/settings
    _configure_displays
    _map_touch

    sleep 30
done
