#!/usr/bin/env bash
# Turn off HYTE screen and stop isolated HYTE services.
set -euo pipefail

systemctl --user stop \
  hyte-webview.service \
  hyte-xserver.service \
  hyte-dashboard.service \
  hyte-backend.service \
  hyte-ambilight.service 2>/dev/null || true
sudo -n systemctl stop hyte-xserver.service 2>/dev/null || true
echo "HYTE screen off (:1 isolated stack stopped)"
