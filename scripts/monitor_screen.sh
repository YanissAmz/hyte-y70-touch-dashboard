#!/bin/bash
# Watchdog : restaure la rotation DP-0 + réagit au hotplug HDMI
# (sinon la matrice touch reste calibrée pour la config à 2 écrans après débranchement TV)
export DISPLAY=:0

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

_apply_layout() {
    if xrandr | grep -q "HDMI-0 connected"; then
        xrandr --output HDMI-0 --auto --primary \
               --output DP-0 --auto --right-of HDMI-0 --rotate right
    else
        xrandr --output HDMI-0 --off 2>/dev/null
        xrandr --output DP-0 --auto --rotate right --primary
    fi
    sleep 1
    _map_touch
}

_hdmi_state() {
    xrandr --query 2>/dev/null | grep -q "^HDMI-0 connected" && echo "on" || echo "off"
}

last_hdmi=$(_hdmi_state)

while true; do
    # 1) Rotation DP-0 perdue → restore complet + relancer webview
    current=$(xrandr --query 2>/dev/null | grep "^DP-0 connected" | grep -oP '\d+x\d+' | head -1)
    if [ "$current" = "3840x1100" ]; then
        logger -t hyte-dashboard "DP-0 rotation lost, restoring..."
        _apply_layout
        sleep 1
        pkill -f "webview.py" 2>/dev/null
        sleep 1
        /usr/bin/python3 /home/yaniss/dashboard/scripts/webview.py &
        logger -t hyte-dashboard "Dashboard restored"
        last_hdmi=$(_hdmi_state)
    fi

    # 2) Hotplug HDMI (branchement/débranchement TV) → ré-appliquer layout + touch mapping
    cur_hdmi=$(_hdmi_state)
    if [ "$cur_hdmi" != "$last_hdmi" ]; then
        logger -t hyte-dashboard "HDMI hotplug: $last_hdmi -> $cur_hdmi, re-applying layout"
        _apply_layout
        # relancer webview pour repositionner sur DP-0 (la géométrie virtuelle a changé)
        pkill -f "webview.py" 2>/dev/null
        sleep 1
        /usr/bin/python3 /home/yaniss/dashboard/scripts/webview.py &
        last_hdmi=$cur_hdmi
    fi

    sleep 3
done
