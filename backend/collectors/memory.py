import psutil


async def collect() -> dict:
    mem = psutil.virtual_memory()
    return {
        "used_gb": round(mem.used / (1024 ** 3), 1),
        "total_gb": round(mem.total / (1024 ** 3), 1),
        "percent": mem.percent,
    }
