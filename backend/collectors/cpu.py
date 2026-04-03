import asyncio
from pathlib import Path

import psutil

from backend.config import HWMON


def _read_cpu_temp() -> int | None:
    hwmon_dir = HWMON.get("cpu_temp")
    if not hwmon_dir:
        return None
    temp_file = Path(hwmon_dir) / "temp1_input"
    if temp_file.exists():
        return int(temp_file.read_text().strip()) // 1000
    return None


async def collect() -> dict:
    usage = await asyncio.to_thread(psutil.cpu_percent, interval=None)
    per_core = await asyncio.to_thread(psutil.cpu_percent, interval=None, percpu=True)
    freq = psutil.cpu_freq()
    temp = _read_cpu_temp()

    return {
        "usage_percent": usage,
        "frequency_ghz": round(freq.current / 1000, 2) if freq else 0,
        "temp_c": temp,
        "per_core": per_core,
    }
