#!/bin/bash
nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader,nounits | awk -F', ' '{printf "%dMB / %dMB", $1, $2}'
