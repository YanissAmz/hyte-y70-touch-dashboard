#!/usr/bin/env bash
set -euo pipefail

# Keep the TV session on the VT owned by the primary GDM Xorg process.
# Starting the isolated HYTE X server on vt8 steals the active VT and
# temporarily suspends :0. Restoring the original VT right after :1 is
# configured lets both GPUs keep scanning out concurrently.

target_vt="$(
  ps -eo args= | awk '
    $1 == "/usr/lib/xorg/Xorg" && $2 ~ /^vt[0-9]+$/ && index($0, "-displayfd") {
      sub(/^vt/, "", $2)
      print $2
      exit
    }
  '
)"

if [[ -z "${target_vt:-}" ]]; then
  active_vt="$(fgconsole 2>/dev/null || cat /sys/class/tty/tty0/active 2>/dev/null || true)"
  target_vt="${active_vt#tty}"
fi

target_vt="${target_vt:-3}"
exec sudo -n /usr/bin/chvt "$target_vt"
