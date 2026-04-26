#!/usr/bin/env bash
# Turn on HYTE screen using the isolated X :1 service and relaunch dashboard.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/ensure_layout.sh"
systemctl --user daemon-reload >/dev/null 2>&1 || true
systemctl --user stop hyte-dashboard.service 2>/dev/null || true
systemctl --user start hyte-backend.service hyte-xserver.service hyte-webview.service
echo "HYTE screen on (:1 active, isolated dashboard started)"
