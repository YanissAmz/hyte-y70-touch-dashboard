#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_ROOT="${HYTE_BACKUP_ROOT:-$REPO_ROOT/backups/hyte-dualx-disabled}"
RESTART_GDM=0

if [[ "${1:-}" == "--restart-gdm" ]]; then
  RESTART_GDM=1
elif [[ $# -gt 0 ]]; then
  echo "Usage: $0 [--restart-gdm]" >&2
  exit 1
fi

restore_from_backup() {
  local src="$1"
  local dst="$2"
  if sudo test -e "$src"; then
    sudo mkdir -p "$(dirname "$dst")"
    sudo mv "$src" "$dst"
    echo "restored: $src -> $dst"
  fi
}

echo "[1/4] Restoring HYTE dual-X Xorg and udev rules"
restore_from_backup \
  "$BACKUP_ROOT/etc/X11/xorg.conf.d/10-nvidia-only.conf" \
  /etc/X11/xorg.conf.d/10-nvidia-only.conf
restore_from_backup \
  "$BACKUP_ROOT/etc/X11/xorg.conf.d/99-hyte-touch-ignore-x0.conf" \
  /etc/X11/xorg.conf.d/99-hyte-touch-ignore-x0.conf
restore_from_backup \
  "$BACKUP_ROOT/etc/udev/rules.d/99-hyte-amdgpu-no-seat.rules" \
  /etc/udev/rules.d/99-hyte-amdgpu-no-seat.rules

echo "[2/4] Reloading udev for DRM devices"
sudo udevadm control --reload
sudo udevadm trigger --subsystem-match=drm --action=change || true

echo "[3/4] Re-enabling HYTE dual-X user services"
systemctl --user enable hyte-backend.service hyte-xserver.service hyte-webview.service 2>/dev/null || true

if [[ "$RESTART_GDM" -eq 1 ]]; then
  echo "[4/4] Restarting GDM now"
  sudo systemctl restart gdm
else
  echo "[4/4] Pending restart"
  echo "HYTE dual-X mode prepared."
  echo "Run 'sudo systemctl restart gdm' or reboot to apply the restore fully."
fi
