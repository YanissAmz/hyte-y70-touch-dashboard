"""Contrôleur des profils d'alimentation GNOME (powerprofilesctl)."""
import subprocess


def get_profile() -> dict:
    try:
        out = subprocess.check_output(["powerprofilesctl", "get"], text=True, timeout=2).strip()
        return {"available": True, "current": out}
    except Exception:
        return {"available": False, "current": None}


def set_profile(profile: str) -> dict:
    if profile not in ("performance", "balanced", "power-saver"):
        return {"ok": False, "error": "invalid profile"}
    try:
        subprocess.run(["powerprofilesctl", "set", profile], check=True, timeout=3)
        return {"ok": True, "current": profile}
    except Exception as e:
        return {"ok": False, "error": str(e)}
