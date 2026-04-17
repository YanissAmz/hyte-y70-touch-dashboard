#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="/home/yaniss/projects/dashboard/backups/hyte-dualx-disabled"
RESTART_GDM=0

if [[ "${1:-}" == "--restart-gdm" ]]; then
  RESTART_GDM=1
elif [[ $# -gt 0 ]]; then
  echo "Usage: $0 [--restart-gdm]" >&2
  exit 1
fi

mkdir -p "$BACKUP_ROOT"
sudo mkdir -p \
  "$BACKUP_ROOT/etc/X11/xorg.conf.d" \
  "$BACKUP_ROOT/etc/udev/rules.d"

move_to_backup() {
  local src="$1"
  local dst="$2"
  if sudo test -e "$src"; then
    sudo mv "$src" "$dst"
    echo "moved: $src -> $dst"
  fi
}

echo "[1/4] Stopping and disabling HYTE dual-X user services"
systemctl --user stop hyte-webview.service hyte-xserver.service hyte-backend.service 2>/dev/null || true
systemctl --user disable hyte-webview.service hyte-xserver.service hyte-backend.service 2>/dev/null || true

echo "[2/4] Removing HYTE-specific Xorg and udev isolation rules from the live system"
move_to_backup /etc/X11/xorg.conf.d/10-nvidia-only.conf \
  "$BACKUP_ROOT/etc/X11/xorg.conf.d/10-nvidia-only.conf"
move_to_backup /etc/X11/xorg.conf.d/99-hyte-touch-ignore-x0.conf \
  "$BACKUP_ROOT/etc/X11/xorg.conf.d/99-hyte-touch-ignore-x0.conf"
move_to_backup /etc/udev/rules.d/99-hyte-amdgpu-no-seat.rules \
  "$BACKUP_ROOT/etc/udev/rules.d/99-hyte-amdgpu-no-seat.rules"

echo "[3/4] Reloading udev for DRM devices"
sudo udevadm control --reload
sudo udevadm trigger --subsystem-match=drm --action=change || true

if [[ "$RESTART_GDM" -eq 1 ]]; then
  echo "[4/4] Restarting GDM now"
  sudo systemctl restart gdm
else
  echo "[4/4] Pending restart"
  echo "Gaming baseline prepared."
  echo "Run 'sudo systemctl restart gdm' or reboot to apply the rollback fully."
fi
