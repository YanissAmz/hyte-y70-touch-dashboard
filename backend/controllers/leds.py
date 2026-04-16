"""LED controller via OpenRGB SDK.

OpenRGB doit tourner en mode serveur : `openrgb --server`
Fiabilité : reconnexion auto, annulation propre des effets animés,
isolation des erreurs par device.
"""
import asyncio
import colorsys
import json
import logging
import os
import pathlib
import subprocess
import threading
import time

_client = None
_effect_task: asyncio.Task | None = None
_current_effect: str = "static"
_current_color: tuple = (255, 255, 255)
# Lock pour éviter la race condition I2C (rainbow thread vs set_color thread)
_led_lock = threading.Lock()
# Délai inter-écriture I2C pour laisser le bus SMBus se stabiliser entre les 2 sticks RAM
_I2C_SETTLE_S = 0.020
# Persistance : dernier état LED restauré au démarrage
_STATE_FILE = pathlib.Path(os.path.expanduser("~/.cache/hyte-dashboard/leds.json"))
_AMBI_CHECK_TTL_S = 1.0
_ambilight_cache_active = False
_ambilight_cache_ts = 0.0


def _save_state():
    try:
        _STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        _STATE_FILE.write_text(json.dumps({
            "effect": _current_effect,
            "color": list(_current_color),
        }))
    except Exception as e:
        logging.debug(f"LED state save: {e}")


def _load_state() -> dict | None:
    try:
        if _STATE_FILE.exists():
            return json.loads(_STATE_FILE.read_text())
    except Exception as e:
        logging.debug(f"LED state load: {e}")
    return None


def _ambilight_sync_active() -> bool:
    """Retourne True si la synchro ambilight externe doit garder la main.

    Check léger avec cache 1s :
    - service `ambilight-sync.service`
    - fallback process `ambilight_unified_sync.py`
    """
    global _ambilight_cache_active, _ambilight_cache_ts
    now = time.monotonic()
    if now - _ambilight_cache_ts < _AMBI_CHECK_TTL_S:
        return _ambilight_cache_active

    active = False
    try:
        proc = subprocess.run(
            ["systemctl", "is-active", "--quiet", "ambilight-sync.service"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        active = proc.returncode == 0
    except Exception:
        active = False

    if not active:
        try:
            proc = subprocess.run(
                ["pgrep", "-f", "ambilight_unified_sync.py"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
            )
            active = proc.returncode == 0
        except Exception:
            active = False

    _ambilight_cache_active = active
    _ambilight_cache_ts = now
    return active


def _is_i2c_device(device) -> bool:
    """Identifie les devices I2C (RAM Corsair/Dominator) qui partagent le bus SMBus."""
    name = getattr(device, "name", "") or ""
    return ("Corsair" in name) or ("Dominator" in name) or ("DIMM" in name)


def _write_device(fn, device, *args):
    """Écrit sur un device avec retry. Sérialise les devices I2C via un petit sleep."""
    if _is_i2c_device(device):
        time.sleep(_I2C_SETTLE_S)
    for attempt in range(2):
        try:
            fn(device, *args)
            return
        except Exception as e:
            if attempt == 0 and _is_i2c_device(device):
                time.sleep(_I2C_SETTLE_S * 2)
                continue
            logging.debug(f"LED write {device.name}: {e}")
            return


# ── Connexion ────────────────────────────────────────────────────────────────

def _get_client():
    global _client
    if _client is not None:
        try:
            _ = len(_client.devices)
            return _client
        except Exception:
            _client = None
    try:
        from openrgb import OpenRGBClient
        c = OpenRGBClient(port=6742)
        # Forcer mode Direct sur les devices qui n'ont que ça (RAM Corsair)
        for d in c.devices:
            modes = [m.name for m in d.modes]
            if "Direct" in modes and len(modes) == 1:
                d.set_mode("Direct")
        _client = c
        return _client
    except Exception as e:
        logging.warning(f"OpenRGB non disponible : {e}")
        return None


# ── Utilitaires couleur ───────────────────────────────────────────────────────

def _hue_to_rgb(hue: float) -> tuple:
    r, g, b = colorsys.hsv_to_rgb(hue % 1.0, 1.0, 1.0)
    return int(r * 255), int(g * 255), int(b * 255)


def _rainbow_colors(n: int, offset: float = 0.0):
    from openrgb.utils import RGBColor
    return [RGBColor(*_hue_to_rgb((i / max(n, 1) + offset) % 1.0)) for i in range(n)]


def _set_device_color_safe(device, color):
    """Applique une couleur sur un device, sans crasher si erreur."""
    try:
        device.set_color(color)
    except Exception as e:
        logging.debug(f"LED set_color {device.name}: {e}")


def _set_device_colors_safe(device, colors):
    try:
        device.set_colors(colors)
    except Exception as e:
        logging.debug(f"LED set_colors {device.name}: {e}")


# ── Arrêt propre de l'animation en cours ─────────────────────────────────────

async def _stop_effect():
    global _effect_task
    if _effect_task and not _effect_task.done():
        _effect_task.cancel()
        try:
            await asyncio.wait_for(_effect_task, timeout=1.0)
        except (asyncio.CancelledError, asyncio.TimeoutError):
            pass
    _effect_task = None


# ── Animations ────────────────────────────────────────────────────────────────

def _rainbow_frame_sync(offset: float):
    if _ambilight_sync_active():
        return
    with _led_lock:
        client = _get_client()
        if client is None:
            return
        for device in client.devices:
            modes = [m.name for m in device.modes]
            if "Direct" in modes and "Rainbow wave" not in modes:
                n = len(device.leds)
                if n == 0:
                    continue
                _write_device(lambda d, c: d.set_colors(c), device, _rainbow_colors(n, offset))


async def _rainbow_loop():
    offset = 0.0
    try:
        while True:
            if _ambilight_sync_active():
                return
            await asyncio.to_thread(_rainbow_frame_sync, offset)
            offset = (offset + 0.012) % 1.0
            await asyncio.sleep(0.1)
    except asyncio.CancelledError:
        pass


def _breathing_frame_sync(r: int, g: int, b: int, brightness: float):
    if _ambilight_sync_active():
        return
    with _led_lock:
        from openrgb.utils import RGBColor
        client = _get_client()
        if client is None:
            return
        color = RGBColor(int(r * brightness), int(g * brightness), int(b * brightness))
        for device in client.devices:
            modes = [m.name for m in device.modes]
            if "Direct" in modes and len(modes) == 1:
                _write_device(lambda d, c: d.set_color(c), device, color)


async def _breathing_loop(r: int, g: int, b: int):
    """Breathing software pour la RAM (les autres devices ont le mode hardware)."""
    import math
    t = 0.0
    try:
        while True:
            if _ambilight_sync_active():
                return
            # Sinus 0→1→0 sur 3 secondes
            brightness = (math.sin(t * math.pi) ** 2)
            await asyncio.to_thread(_breathing_frame_sync, r, g, b, brightness)
            t = (t + 0.067) % 2.0  # période 3s à 100ms/frame
            await asyncio.sleep(0.1)
    except asyncio.CancelledError:
        pass


# ── API publique ──────────────────────────────────────────────────────────────

EFFECTS = {
    # nom          : (mode hardware MSI,   animation software)
    "rainbow"      : ("Rainbow wave",      "rainbow"),
    "breathing"    : ("Breathing",         "breathing"),
    "color_wave"   : ("Color wave",        None),
    "fire"         : ("Fire",              None),
    "meteor"       : ("Meteor",            None),
    "energy"       : ("Energy",            None),
    "stack"        : ("Stack",             None),
    "visor"        : ("Visor",             None),
    "static"       : (None,                None),
    "off"          : (None,                None),
}


def _apply_effect_sync(effect: str, r: int, g: int, b: int):
    with _led_lock:
        _apply_effect_locked(effect, r, g, b)


def _apply_effect_locked(effect: str, r: int, g: int, b: int):
    from openrgb.utils import RGBColor
    client = _get_client()
    if client is None:
        return

    hw_mode, _ = EFFECTS.get(effect, (None, None))
    color = RGBColor(r, g, b)

    if effect == "off":
        for d in client.devices:
            _set_device_color_safe(d, RGBColor(0, 0, 0))
        return

    if effect == "rainbow":
        # MSI → hardware rainbow; RAM → géré par la loop async
        for d in client.devices:
            modes = [m.name for m in d.modes]
            if "Rainbow wave" in modes:
                try:
                    d.set_mode("Rainbow wave")
                except Exception:
                    pass
        return

    if effect == "breathing":
        # MSI → hardware Breathing avec la couleur; RAM → loop async
        for d in client.devices:
            modes = [m.name for m in d.modes]
            if "Breathing" in modes:
                try:
                    d.set_mode("Breathing")
                    d.set_color(color)
                except Exception:
                    pass
        return

    # Autres effets hardware ou static
    for d in client.devices:
        modes = [m.name for m in d.modes]
        if hw_mode and hw_mode in modes:
            try:
                d.set_mode(hw_mode)
                try:
                    d.set_color(color)
                except Exception:
                    pass
            except Exception:
                _set_device_color_safe(d, color)
        else:
            # Fallback : forcer Direct puis couleur (RAM, etc.)
            if "Direct" in modes:
                try:
                    d.set_mode("Direct")
                except Exception:
                    pass
            _set_device_color_safe(d, color)


async def set_effect(effect: str, r: int = 255, g: int = 255, b: int = 255):
    global _effect_task, _current_effect, _current_color
    if _ambilight_sync_active():
        await _stop_effect()
        return {"status": "blocked", "reason": "ambilight_active"}
    await _stop_effect()
    _current_effect = effect
    _current_color = (r, g, b)

    await asyncio.to_thread(_apply_effect_sync, effect, r, g, b)

    _, sw_anim = EFFECTS.get(effect, (None, None))
    if sw_anim == "rainbow":
        _effect_task = asyncio.create_task(_rainbow_loop())
    elif sw_anim == "breathing":
        _effect_task = asyncio.create_task(_breathing_loop(r, g, b))
    _save_state()
    return {"status": "ok"}


async def set_color(r: int, g: int, b: int):
    """Couleur statique sur tous les devices — arrête tout effet en cours."""
    global _current_effect, _current_color
    if _ambilight_sync_active():
        await _stop_effect()
        return {"status": "blocked", "reason": "ambilight_active"}
    await _stop_effect()
    _current_effect = "static"
    _current_color = (r, g, b)
    await asyncio.to_thread(_set_color_all_sync, r, g, b)
    _save_state()
    return {"status": "ok"}


def _set_color_all_sync(r: int, g: int, b: int):
    with _led_lock:
        from openrgb.utils import RGBColor
        client = _get_client()
        if client is None:
            return
        color = RGBColor(r, g, b)
        for d in client.devices:
            modes = [m.name for m in d.modes]
            # Toujours forcer Direct avant d'appliquer une couleur statique
            if "Direct" in modes:
                try:
                    d.set_mode("Direct")
                except Exception:
                    pass
            _write_device(lambda dv, c: dv.set_color(c), d, color)


async def turn_off():
    return await set_effect("off")


async def restore_state():
    """Restaure le dernier état LED sauvegardé (appelé au démarrage backend)."""
    if _ambilight_sync_active():
        await _stop_effect()
        return
    st = _load_state()
    if not st:
        return
    effect = st.get("effect", "static")
    r, g, b = st.get("color", [255, 255, 255])
    try:
        if effect == "static":
            await set_color(r, g, b)
        else:
            await set_effect(effect, r, g, b)
    except Exception as e:
        logging.warning(f"LED restore_state: {e}")


def get_status() -> dict:
    client = _get_client()
    if client is None:
        return {
            "available": False,
            "devices": [],
            "effect": _current_effect,
            "ambilight_active": _ambilight_sync_active(),
        }
    try:
        devices = [{"name": d.name, "leds": len(d.leds)} for d in client.devices]
        return {
            "available": True,
            "devices": devices,
            "effect": _current_effect,
            "ambilight_active": _ambilight_sync_active(),
        }
    except Exception:
        return {
            "available": False,
            "devices": [],
            "effect": _current_effect,
            "ambilight_active": _ambilight_sync_active(),
        }
