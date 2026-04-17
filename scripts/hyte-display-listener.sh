#!/bin/bash
# Listens on the GNOME Mutter D-Bus for display layout changes and triggers a
# reconfigure. This is the event-driven replacement for the old 30s poll loop
# in monitor_screen.sh.
#
# Behaviour: on each MonitorsChanged event, re-run configure-displays.sh and
# restart the webview so it re-pins to the correct xrandr monitor index.
# Events are debounced (200ms) because GNOME often fires several in a burst
# during monitor plug/unplug.

set -u
export DISPLAY="${DISPLAY:-:0}"

SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
LAST_EVENT=0
DEBOUNCE_MS=200

_now_ms() { echo $(($(date +%s%N) / 1000000)); }

_handle_event() {
    local now
    now=$(_now_ms)
    if (( now - LAST_EVENT < DEBOUNCE_MS )); then
        return
    fi
    LAST_EVENT=$now
    # Small settling delay so xrandr --query returns the new state.
    sleep 0.25
    "$SCRIPT_DIR/configure-displays.sh" >/dev/null 2>&1 || true
    systemctl --user try-restart hyte-webview.service 2>/dev/null || true
    logger -t hyte-display-listener "reconfigured after MonitorsChanged"
}

# One reconfig at boot so we don't rely solely on a hotplug.
"$SCRIPT_DIR/configure-displays.sh" >/dev/null 2>&1 || true

# gdbus monitor emits one line per signal. Filter for MonitorsChanged.
gdbus monitor --session --dest org.gnome.Mutter.DisplayConfig 2>/dev/null \
    | while read -r line; do
        case "$line" in
            *MonitorsChanged*) _handle_event ;;
        esac
    done
