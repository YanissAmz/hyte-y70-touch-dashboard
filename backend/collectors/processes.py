import asyncio

import psutil


async def collect() -> dict:
    procs = await asyncio.to_thread(_get_top_cpu)
    return {"top_cpu": procs}


def _get_top_cpu() -> list[dict]:
    result = []
    for p in psutil.process_iter(["pid", "name", "cpu_percent"]):
        try:
            info = p.info
            if info["cpu_percent"] and info["cpu_percent"] > 0.1:
                result.append({
                    "pid": info["pid"],
                    "name": info["name"],
                    "cpu_percent": round(info["cpu_percent"], 1),
                })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    result.sort(key=lambda x: x["cpu_percent"], reverse=True)
    return result[:8]
