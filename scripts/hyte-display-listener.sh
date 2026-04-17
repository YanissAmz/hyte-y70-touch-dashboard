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
DEBOUNCE_MS=2000    # GNOME fires 3-6 MonitorsChanged during a plug/unplug burst
COOLDOWN_MS=5000    # don't restart webview more than once per 5s

_now_ms() { echo $(($(date +%s%N) / 1000000)); }

_handle_event() {
    local now
    now=$(_now_ms)
    if (( now - LAST_EVENT < DEBOUNCE_MS )); then
        return
    fi
    LAST_EVENT=$now
    # Wait a bit longer so GNOME's burst settles and xrandr sees the final state.
    sleep 1
    "$SCRIPT_DIR/configure-displays.sh" >/dev/null 2>&1 || true
    # Only restart the webview if cooldown elapsed — avoids the systemd
    # start-limit when GNOME emits repeated events at login.
    if (( now - LAST_RESTART > COOLDOWN_MS )); then
        LAST_RESTART=$now
        systemctl --user try-restart hyte-webview.service 2>/dev/null || true
    fi
    logger -t hyte-display-listener "reconfigured after MonitorsChanged"
}

LAST_RESTART=0

# One reconfig at boot so we don't rely solely on a hotplug.
"$SCRIPT_DIR/configure-displays.sh" >/dev/null 2>&1 || true

# gdbus monitor emits one line per signal. Filter for MonitorsChanged.
gdbus monitor --session --dest org.gnome.Mutter.DisplayConfig 2>/dev/null \
    | while read -r line; do
        case "$line" in
            *MonitorsChanged*) _handle_event ;;
        esac
    done
