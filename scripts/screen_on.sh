#!/usr/bin/env bash
# Turn on HYTE screen using the isolated X :1 service and relaunch dashboard.
set -euo pipefail

/home/yaniss/projects/dashboard/scripts/ensure_layout.sh
systemctl --user daemon-reload >/dev/null 2>&1 || true
systemctl --user start hyte-backend.service hyte-dashboard.service
echo "HYTE screen on (:1 active, dashboard started)"
