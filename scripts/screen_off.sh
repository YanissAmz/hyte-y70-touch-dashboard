#!/usr/bin/env bash
# Turn off HYTE screen and stop isolated HYTE services.
set -euo pipefail

systemctl --user stop hyte-dashboard.service hyte-backend.service hyte-ambilight.service 2>/dev/null || true
sudo -n systemctl stop hyte-xserver.service
echo "HYTE screen off (:1 stopped)"
