import asyncio
import os

from backend.config import DISPLAY


async def _run(cmd: list[str]):
    env = os.environ.copy()
    env["DISPLAY"] = DISPLAY
    proc = await asyncio.create_subprocess_exec(
        *cmd, env=env,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL
    )
    await proc.communicate()


async def _hdmi_connected() -> bool:
    env = os.environ.copy()
    env["DISPLAY"] = DISPLAY
    proc = await asyncio.create_subprocess_exec(
        "xrandr", "--query", env=env,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL
    )
    stdout, _ = await proc.communicate()
    return b"HDMI-0 connected" in stdout


async def screen_off():
    await _run(["xrandr", "--output", "DP-0", "--off"])


async def screen_on():
    if await _hdmi_connected():
        await _run(["xrandr", "--output", "DP-0", "--auto", "--right-of", "HDMI-0", "--rotate", "right"])
    else:
        await _run(["xrandr", "--output", "DP-0", "--auto", "--rotate", "right", "--primary"])
