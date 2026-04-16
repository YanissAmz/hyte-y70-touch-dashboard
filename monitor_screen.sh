#!/bin/bash
# Watchdog : restaure la rotation DP-0 sur :1 + réagit au hotplug HDMI sur :0
# Architecture : GNOME sur :0 (HDMI-0 uniquement), HYTE sur :1 (DP-0 isolé)
export DISPLAY=:1
DASHBOARD_DIR="/home/yaniss/projects/dashboard"
SUSPEND_FLAG="/tmp/hyte-dashboard-suspended"
GAME_LITE_FLAG="/tmp/hyte-dashboard-game-lite"

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
    for id in $(xinput list --id-only 2>/dev/null); do
        name=$(xinput list --name-only "$id" 2>/dev/null)
        case "$name" in
            *ILITEK*ILITEK-TOUCH*)
                xinput set-prop "$id" "libinput Calibration Matrix" 1 0 0 0 1 0 0 0 1 2>/dev/null
                xinput --map-to-output "$id" DP-0 2>/dev/null
                ;;
        esac
    done
}

_apply_dp0_rotation() {
    # Apply/restore portrait rotation on :1 (HYTE X server)
    xrandr --output DP-0 --auto --rotate right 2>/dev/null
    sleep 1
    _map_touch
}

_hdmi_state() {
    DISPLAY=:0 xrandr --query 2>/dev/null | grep -q "^HDMI-0 connected" && echo "on" || echo "off"
}

last_hdmi=$(_hdmi_state)
if [ ! -f "$SUSPEND_FLAG" ]; then
    _apply_dp0_rotation
fi
_ensure_backend
_ensure_webview

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

    # 1) Rotation DP-0 perdue → restore + relancer webview
    current_line=$(xrandr --query 2>/dev/null | grep "^DP-0 connected")
    if ! printf '%s\n' "$current_line" | grep -q "1100x3840" || ! printf '%s\n' "$current_line" | grep -q " right "; then
        logger -t hyte-dashboard "DP-0 rotation lost on :1, restoring..."
        _apply_dp0_rotation
        sleep 1
        pkill -f "webview.py" 2>/dev/null
        sleep 1
        /usr/bin/python3 "$DASHBOARD_DIR/scripts/webview.py" &
        logger -t hyte-dashboard "Dashboard restored"
        last_hdmi=$(_hdmi_state)
    fi

    # 2) Hotplug HDMI (branchement/débranchement TV) → pas d'impact sur DP-0/:1
    cur_hdmi=$(_hdmi_state)
    if [ "$cur_hdmi" != "$last_hdmi" ]; then
        logger -t hyte-dashboard "HDMI hotplug: $last_hdmi -> $cur_hdmi"
        # DP-0 sur :1 n'est pas affecté par le hotplug HDMI sur :0
        # Relancer webview uniquement si needed (géométrie :1 inchangée)
        pkill -f "webview.py" 2>/dev/null
        sleep 1
        /usr/bin/python3 "$DASHBOARD_DIR/scripts/webview.py" &
        last_hdmi=$cur_hdmi
    fi

    sleep 10
done
