"""LED controller via OpenRGB SDK.

OpenRGB doit tourner en mode serveur : `openrgb --server`
Fiabilité : reconnexion auto, annulation propre des effets animés,
isolation des erreurs par device.
"""
import asyncio
import colorsys
import logging
import threading

_client = None
_effect_task: asyncio.Task | None = None
_current_effect: str = "static"
# Lock pour éviter la race condition I2C (rainbow thread vs set_color thread)
_led_lock = threading.Lock()


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
                _set_device_colors_safe(device, _rainbow_colors(n, offset))


async def _rainbow_loop():
    offset = 0.0
    try:
        while True:
            await asyncio.to_thread(_rainbow_frame_sync, offset)
            offset = (offset + 0.012) % 1.0
            await asyncio.sleep(0.1)
    except asyncio.CancelledError:
        pass


def _breathing_frame_sync(r: int, g: int, b: int, brightness: float):
    with _led_lock:
        from openrgb.utils import RGBColor
        client = _get_client()
        if client is None:
            return
        color = RGBColor(int(r * brightness), int(g * brightness), int(b * brightness))
        for device in client.devices:
            modes = [m.name for m in device.modes]
            if "Direct" in modes and len(modes) == 1:
                _set_device_color_safe(device, color)


async def _breathing_loop(r: int, g: int, b: int):
    """Breathing software pour la RAM (les autres devices ont le mode hardware)."""
    import math
    t = 0.0
    try:
        while True:
            # Sinus 0→1→0 sur 3 secondes
            brightness = (math.sin(t * math.pi) ** 2)
            await asyncio.to_thread(_breathing_frame_sync, r, g, b, brightness)
            t = (t + 0.067) % 2.0  # période 3s à 100ms/frame
            await asyncio.sleep(0.1)
    except asyncio.CancelledError:
        pass


# ── API publique ──────────────────────────────────────────────────────────────

EFFECTS = {
    # nom          : (mode hardware MSI,   animation software RAM)
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
    global _effect_task, _current_effect
    await _stop_effect()
    _current_effect = effect

    await asyncio.to_thread(_apply_effect_sync, effect, r, g, b)

    _, sw_anim = EFFECTS.get(effect, (None, None))
    if sw_anim == "rainbow":
        _effect_task = asyncio.create_task(_rainbow_loop())
    elif sw_anim == "breathing":
        _effect_task = asyncio.create_task(_breathing_loop(r, g, b))


async def set_color(r: int, g: int, b: int):
    """Couleur statique sur tous les devices — arrête tout effet en cours."""
    global _current_effect
    await _stop_effect()
    _current_effect = "static"
    await asyncio.to_thread(_set_color_all_sync, r, g, b)


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
            _set_device_color_safe(d, color)


async def turn_off():
    await set_effect("off")


def get_status() -> dict:
    client = _get_client()
    if client is None:
        return {"available": False, "devices": [], "effect": _current_effect}
    try:
        devices = [{"name": d.name, "leds": len(d.leds)} for d in client.devices]
        return {"available": True, "devices": devices, "effect": _current_effect}
    except Exception:
        return {"available": False, "devices": [], "effect": _current_effect}
