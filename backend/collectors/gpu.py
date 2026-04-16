import pynvml

_handle = None


def init():
    global _handle
    if _handle is not None:
        return
    pynvml.nvmlInit()
    _handle = pynvml.nvmlDeviceGetHandleByIndex(0)


def shutdown():
    try:
        pynvml.nvmlShutdown()
    except Exception:
        pass


async def collect() -> dict:
    global _handle
    if _handle is None:
        try:
            init()
        except Exception:
            return {}

    util = pynvml.nvmlDeviceGetUtilizationRates(_handle)
    temp = pynvml.nvmlDeviceGetTemperature(_handle, pynvml.NVML_TEMPERATURE_GPU)
    power = pynvml.nvmlDeviceGetPowerUsage(_handle) / 1000
    mem = pynvml.nvmlDeviceGetMemoryInfo(_handle)

    top_processes = []
    try:
        procs = pynvml.nvmlDeviceGetComputeRunningProcesses(_handle)
        for p in procs[:5]:
            try:
                import psutil
                name = psutil.Process(p.pid).name()
            except Exception:
                name = str(p.pid)
            top_processes.append({
                "pid": p.pid,
                "name": name,
                "vram_mb": round(p.usedGpuMemory / (1024 ** 2)) if p.usedGpuMemory else 0,
            })
    except Exception:
        pass

    return {
        "utilization_percent": util.gpu,
        "temp_c": temp,
        "power_w": round(power, 1),
        "vram_used_mb": round(mem.used / (1024 ** 2)),
        "vram_total_mb": round(mem.total / (1024 ** 2)),
        "vram_percent": round(mem.used / mem.total * 100, 1),
        "top_processes": top_processes,
    }
