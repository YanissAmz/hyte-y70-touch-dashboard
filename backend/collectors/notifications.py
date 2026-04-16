"""Intercepte les notifications D-Bus via dbus-monitor subprocess.

Écoute les appels Notify() sur org.freedesktop.Notifications et les
broadcastes en temps réel via WebSocket.
"""
import asyncio
import logging
import os
import re
import time
from collections import deque

_notifications: deque = deque(maxlen=20)
_monitor_task = None

# Regex pour parser la sortie de dbus-monitor
_RE_STRING = re.compile(r'string\s+"((?:[^"\\]|\\.)*)"')
_RE_UINT32 = re.compile(r'uint32\s+(\d+)')


def _parse_notify_block(block: str) -> dict | None:
    """Parse un bloc dbus-monitor correspondant à un appel Notify()."""
    if 'member=Notify' not in block:
        return None
    strings = _RE_STRING.findall(block)
    uints   = _RE_UINT32.findall(block)
    if len(strings) < 2:
        return None
    app_name = strings[0] if strings else "system"
    app_icon = strings[1] if len(strings) > 1 else ""
    summary  = strings[2] if len(strings) > 2 else ""
    body     = strings[3] if len(strings) > 3 else ""
    notif_id = int(uints[0]) if uints else int(time.time() * 1000) % 100000
    return {
        "id":      notif_id,
        "app":     app_name,
        "icon":    app_icon,
        "summary": summary,
        "body":    body,
        "ts":      int(time.time()),
    }


async def _monitor_loop(broadcast_fn):
    dbus_addr = os.environ.get("DBUS_SESSION_BUS_ADDRESS", "")
    if not dbus_addr:
        logging.warning("Notifications: DBUS_SESSION_BUS_ADDRESS non défini")
        return

    cmd = [
        "dbus-monitor",
        "--session",
        "type='method_call',interface='org.freedesktop.Notifications',member='Notify'"
    ]
    env = {**os.environ, "DBUS_SESSION_BUS_ADDRESS": dbus_addr}

    proc = None
    while True:
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
                env=env,
            )
            buffer = []
            async for raw_line in proc.stdout:
                line = raw_line.decode("utf-8", errors="replace").rstrip()
                if line.startswith("method call") and buffer:
                    block = "\n".join(buffer)
                    notif = _parse_notify_block(block)
                    if notif:
                        _notifications.appendleft(notif)
                        await broadcast_fn("notifications", {"list": list(_notifications)})
                    buffer = [line]
                else:
                    buffer.append(line)
        except asyncio.CancelledError:
            if proc:
                try:
                    proc.kill()
                    await proc.wait()
                except Exception:
                    pass
            return
        except Exception as e:
            logging.warning(f"Notifications monitor crashed: {e}")
            await asyncio.sleep(5)


async def start_monitor(broadcast_fn):
    global _monitor_task
    if _monitor_task is None or _monitor_task.done():
        _monitor_task = asyncio.create_task(_monitor_loop(broadcast_fn))


async def stop_monitor():
    global _monitor_task
    if _monitor_task is not None:
        _monitor_task.cancel()
        try:
            await _monitor_task
        except BaseException:
            pass
        _monitor_task = None


async def collect() -> dict:
    return {"list": list(_notifications)}
