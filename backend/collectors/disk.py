import asyncio
from pathlib import Path

import psutil

from backend.config import HWMON

_prev_io = None
_prev_ts = None


def _read_nvme_temp() -> int | None:
    hwmon_dir = HWMON.get("nvme_temp")
    if not hwmon_dir:
        return None
    temp_file = Path(hwmon_dir) / "temp1_input"
    if temp_file.exists():
        return int(temp_file.read_text().strip()) // 1000
    return None


async def collect() -> dict:
    global _prev_io, _prev_ts
    import time

    usage = await asyncio.to_thread(psutil.disk_usage, "/")
    io = psutil.disk_io_counters()
    now = time.monotonic()

    io_read_bps = 0
    io_write_bps = 0
    if _prev_io and _prev_ts:
        dt = now - _prev_ts
        if dt > 0:
            io_read_bps = round((io.read_bytes - _prev_io.read_bytes) / dt)
            io_write_bps = round((io.write_bytes - _prev_io.write_bytes) / dt)

    _prev_io = io
    _prev_ts = now

    return {
        "usage_percent": usage.percent,
        "used_gb": round(usage.used / (1024 ** 3), 1),
        "total_gb": round(usage.total / (1024 ** 3), 1),
        "io_read_bps": io_read_bps,
        "io_write_bps": io_write_bps,
        "nvme_temp_c": _read_nvme_temp(),
    }
