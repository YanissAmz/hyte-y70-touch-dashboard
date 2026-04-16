"""Ambilight color collector — reads /tmp/ambilight-color written by
ambilight_to_openrgb.py and broadcasts to WS clients with delta-gating.

File format: single line "R G B\n" with decimal 0-255 ints.
Fallback navy (2,5,20) when file missing or stale >30s.
"""
from __future__ import annotations

import asyncio
import time
from pathlib import Path

COLOR_FILE    = Path("/tmp/ambilight-color")
STALE_SECONDS = 30.0
MIN_DELTA     = 4    # skip broadcast if |ΔR|+|ΔG|+|ΔB| < this

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


async def run(broadcast, interval: float = 0.5) -> None:
    """Long-running task: read file every `interval` seconds, emit only on
    significant color change or on state change (live <-> fallback)."""
    last: dict | None = None
    while True:
        cur = _read() or FALLBACK
        if last is None or _abs_delta(cur, last) >= MIN_DELTA:
            try:
                await broadcast("ambilight", cur)
            except Exception:
                pass
            last = cur
        await asyncio.sleep(interval)


def _abs_delta(a: dict, b: dict) -> int:
    return abs(a["r"] - b["r"]) + abs(a["g"] - b["g"]) + abs(a["b"] - b["b"])


async def snapshot() -> dict:
    """One-shot read for new WS clients."""
    return _read() or FALLBACK
