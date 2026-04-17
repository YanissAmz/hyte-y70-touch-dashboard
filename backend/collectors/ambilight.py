"""Ambilight color collector — reads /tmp/ambilight-color written by
ambilight_unified_sync.py (infra-home) and broadcasts on WS.

Event-driven via watchfiles (inotify-backed): wakes up only on file
writes, so HYTE tracks the LEDs/Govee/Hue in near-real-time instead of
averaging 250ms of 0.5s polling lag. A 1Hz background tick is still
kept to emit the fallback color when the TV goes off (no more writes).

File format: single line "R G B\\n" with decimal 0-255 ints.
Fallback navy (2,5,20) when file missing or stale >30s.
"""
from __future__ import annotations

import asyncio
import time
from pathlib import Path

from watchfiles import awatch

COLOR_FILE    = Path("/tmp/ambilight-color")
STALE_SECONDS = 30.0
MIN_DELTA     = 4

FALLBACK = {"r": 2, "g": 5, "b": 20}


def _read() -> dict | None:
    try:
        stat = COLOR_FILE.stat()
        if time.time() - stat.st_mtime > STALE_SECONDS:
            return None
        parts = COLOR_FILE.read_text().split()
        if len(parts) < 3:
            return None
        return {"r": int(parts[0]), "g": int(parts[1]), "b": int(parts[2])}
    except Exception:
        return None


def _abs_delta(a: dict, b: dict) -> int:
    return abs(a["r"] - b["r"]) + abs(a["g"] - b["g"]) + abs(a["b"] - b["b"])


async def snapshot() -> dict:
    """One-shot read for new WS clients joining mid-stream."""
    return _read() or FALLBACK


async def run(broadcast, interval: float = 0.5) -> None:
    """Long-running task. Event-driven with a stale-watchdog fallback.

    `interval` is kept in the signature for backward-compat with the
    scheduler but is no longer the primary cadence — file writes drive
    the emits. The staleness watcher runs at a fixed 1s.
    """
    _ = interval

    async def emit(last: dict | None) -> dict:
        cur = _read() or FALLBACK
        if last is None or _abs_delta(cur, last) >= MIN_DELTA:
            try:
                await broadcast("ambilight", cur)
            except Exception:
                pass
        return cur

    # Initial broadcast so the first WS client sees a colour immediately.
    last = await emit(None)

    stale_task = asyncio.create_task(_stale_watcher(broadcast))

    try:
        # Watch the directory rather than the file — watchfiles raises if
        # the path doesn't exist yet, and /tmp/ambilight-color can be
        # missing between TV off and the first write.
        async for _changes in awatch(
            str(COLOR_FILE.parent),
            watch_filter=lambda change, path: Path(path) == COLOR_FILE,
            step=20,      # inotify debounce window in ms — 20ms keeps us TV-tight
            yield_on_timeout=False,
        ):
            last = await emit(last)
    finally:
        stale_task.cancel()


async def _stale_watcher(broadcast) -> None:
    """Emit the fallback when the source file goes stale (TV off).
    1s cadence is fine — this is a state-change detector, not a throughput
    path. When the file is being written normally, this never emits."""
    last_was_fallback = False
    while True:
        await asyncio.sleep(1.0)
        cur = _read()
        if cur is None and not last_was_fallback:
            try:
                await broadcast("ambilight", FALLBACK)
            except Exception:
                pass
            last_was_fallback = True
        elif cur is not None:
            last_was_fallback = False
