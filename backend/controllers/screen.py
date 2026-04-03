import asyncio
import os

from backend.config import DISPLAY


async def _run(cmd: list[str]):
    env = os.environ.copy()
    env["DISPLAY"] = DISPLAY
    proc = await asyncio.create_subprocess_exec(
        *cmd, env=env,
        stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL
    )
    await proc.communicate()


async def screen_off():
    await _run(["xrandr", "--output", "DP-0", "--off"])


async def screen_on():
    await _run(["xrandr", "--output", "DP-0", "--auto", "--right-of", "HDMI-0", "--rotate", "right"])
