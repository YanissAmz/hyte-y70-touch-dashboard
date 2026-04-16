"""Game center — enumerate & launch games from XDG .desktop files.

Scans ~/Bureau/ and ~/.local/share/applications/ for Desktop Entries whose
Icon= path lives under ~/.local/share/icons/game-launchers/. Deduped by Exec.
Launch fires the Exec command in a detached session with its cwd set to the
Path= field if present (needed for RDR2 / GTA wrappers).
"""
from __future__ import annotations

import configparser
import os
import subprocess
from pathlib import Path
from typing import Iterable


HOME          = Path.home()
ICONS_DIR     = HOME / ".local" / "share" / "icons" / "game-launchers"
DESKTOP_DIRS  = [HOME / "Bureau", HOME / "Desktop", HOME / ".local" / "share" / "applications"]


def _parse_desktop(path: Path) -> dict[str, str] | None:
    cp = configparser.RawConfigParser(interpolation=None, strict=False)
    cp.optionxform = str  # preserve case
    try:
        cp.read(path, encoding="utf-8")
    except Exception:
        return None
    section = "Desktop Entry"
    if section not in cp:
        return None
    d = dict(cp.items(section))
    if d.get("Type") != "Application":
        return None
    if not d.get("Exec") or not d.get("Icon") or not d.get("Name"):
        return None
    return d


def _slug(name: str) -> str:
    return "".join(c.lower() if c.isalnum() else "-" for c in name).strip("-")


def _is_game_icon(icon: str) -> bool:
    try:
        return Path(icon).resolve().is_relative_to(ICONS_DIR.resolve())
    except (OSError, ValueError):
        return False


def _iter_desktop_files() -> Iterable[Path]:
    for d in DESKTOP_DIRS:
        if not d.exists():
            continue
        for f in d.iterdir():
            if f.suffix == ".desktop" and f.is_file():
                yield f


def list_games() -> list[dict[str, str]]:
    seen_exec: set[str] = set()
    games: list[dict[str, str]] = []
    for f in _iter_desktop_files():
        d = _parse_desktop(f)
        if not d:
            continue
        if not _is_game_icon(d["Icon"]):
            continue
        exec_cmd = d["Exec"].split("%")[0].strip()  # strip field codes like %U
        if exec_cmd in seen_exec:
            continue
        seen_exec.add(exec_cmd)
        icon_file = Path(d["Icon"]).name
        games.append({
            "id":       _slug(d["Name"]),
            "name":     d["Name"],
            "icon":     icon_file,
            "icon_url": f"/api/games/icons/{icon_file}",
            "exec":     exec_cmd,
            "cwd":      d.get("Path", "") or "",
        })
    games.sort(key=lambda g: g["name"].lower())
    return games


def launch_game(game_id: str) -> dict[str, str]:
    target: dict[str, str] | None = next(
        (g for g in list_games() if g["id"] == game_id), None,
    )
    if target is None:
        return {"status": "error", "message": f"Unknown game id: {game_id}"}
    cmd = target["exec"]
    cwd = target["cwd"] or str(HOME)
    # Parse cmd respecting quoted args (rare for our wrappers, but safe)
    import shlex
    argv = shlex.split(cmd)
    env = os.environ.copy()
    env.setdefault("DISPLAY", ":0")
    try:
        subprocess.Popen(
            argv,
            cwd=cwd if Path(cwd).is_dir() else None,
            env=env,
            start_new_session=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except FileNotFoundError:
        return {"status": "error", "message": f"Executable not found: {argv[0]}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    return {"status": "ok", "launched": target["name"]}
