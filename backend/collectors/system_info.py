import asyncio
import platform
import time

import psutil

from backend.config import HW_CPU_MODEL, HW_GPU_MODEL, HW_RAM_MODEL, HW_DISK_MODEL


async def _run_cmd(cmd: list[str]) -> str:
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=5)
        return stdout.decode().strip()
    except Exception:
        return ""


async def _get_docker_containers() -> list[dict]:
    out = await _run_cmd(["docker", "ps", "--format", "{{.Names}}\t{{.Status}}\t{{.Image}}"])
    containers = []
    for line in out.splitlines():
        parts = line.split("\t")
        if len(parts) >= 3:
            containers.append({
                "name": parts[0],
                "status": parts[1],
                "image": parts[2],
            })
    return containers


async def collect() -> dict:
    boot_time = psutil.boot_time()
    uptime_s = int(time.time() - boot_time)
    docker = await _get_docker_containers()

    return {
        "hostname": platform.node(),
        "uptime_s": uptime_s,
        "kernel": platform.release(),
        "os": await _run_cmd(["lsb_release", "-ds"]) or "Ubuntu",
        "cpu_model": HW_CPU_MODEL,
        "gpu_model": HW_GPU_MODEL,
        "ram_model": HW_RAM_MODEL,
        "disk_model": HW_DISK_MODEL,
        "docker_containers": docker,
    }
