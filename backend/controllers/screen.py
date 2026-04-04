import asyncio
import logging
import os

import serial

from backend.config import DISPLAY, SERIAL_DEVICE, SERIAL_BAUD


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
    """Veille DPMS — garde la connexion X11 active, juste l'affichage s'éteint."""
    await _run(["xset", "-display", DISPLAY, "dpms", "force", "off"])


async def screen_on():
    """Réveil DPMS — rallume l'écran sans toucher à la config xrandr."""
    await _run(["xset", "-display", DISPLAY, "dpms", "force", "on"])
    await _run(["xset", "-display", DISPLAY, "-dpms"])  # disable auto-sleep


def _set_brightness_sync(level: int):
    """Protocole HYTE Y70 : FF CC 01 [on=1] [brightness 0-100]"""
    level = max(0, min(100, level))
    on_off = 0x00 if level == 0 else 0x01
    try:
        with serial.Serial(SERIAL_DEVICE, SERIAL_BAUD, timeout=1) as ser:
            ser.write(bytes([0xFF, 0xCC, 0x01, on_off, level]))
            ser.flush()
    except Exception as e:
        logging.warning(f"Screen brightness serial error: {e}")


async def set_brightness(level: int):
    await asyncio.to_thread(_set_brightness_sync, level)
