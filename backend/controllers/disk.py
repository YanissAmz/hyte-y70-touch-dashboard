"""Disk usage tree. Runs `du -b --max-depth=1` on a path and returns the
immediate children sorted by size. Results are cached per-path for 60s
because `du` on large dirs is CPU-heavy.
"""
import asyncio
import os
import time

_CACHE: dict[str, tuple[float, list[dict]]] = {}
_TTL = 60.0


def _sibling_path(parent: str, name: str) -> str:
    if parent.endswith("/"):
        return f"{parent}{name}"
    return f"{parent}/{name}"


async def tree(path: str) -> dict:
    # Guard: only allow absolute existing paths
    if not path or not path.startswith("/") or not os.path.isdir(path):
        return {"path": path, "total": 0, "entries": [], "error": "invalid path"}

    now = time.time()
    cached = _CACHE.get(path)
    if cached and (now - cached[0]) < _TTL:
        entries = cached[1]
    else:
        entries = await _scan(path)
        _CACHE[path] = (now, entries)

    total = sum(e["size_bytes"] for e in entries)
    return {"path": path, "total": total, "entries": entries}


async def _scan(path: str) -> list[dict]:
    # -b: bytes (no 1K rounding)
    # -x: stay on same filesystem (avoid mount points pulling GBs from elsewhere)
    # --max-depth=1: immediate children + total
    # We also cap the run with a 15s timeout so tapping a pathological dir
    # doesn't lock the endpoint.
    try:
        proc = await asyncio.create_subprocess_exec(
            "du", "-b", "-x", "--max-depth=1", path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=15)
    except (asyncio.TimeoutError, FileNotFoundError):
        return []

    entries: list[dict] = []
    seen_total = False
    for line in stdout.decode(errors="replace").splitlines():
        parts = line.split("\t", 1)
        if len(parts) != 2:
            continue
        try:
            size = int(parts[0])
        except ValueError:
            continue
        child = parts[1].rstrip("/")
        # `du --max-depth=1 /foo` emits `/foo` last as the total — skip it
        if child == path.rstrip("/") or child == path:
            seen_total = True
            continue
        name = child.rsplit("/", 1)[-1] or child
        try:
            is_dir = os.path.isdir(child)
        except OSError:
            is_dir = False
        entries.append({
            "name": name,
            "path": child,
            "size_bytes": size,
            "is_dir": is_dir,
        })
    _ = seen_total
    entries.sort(key=lambda e: e["size_bytes"], reverse=True)
    return entries
