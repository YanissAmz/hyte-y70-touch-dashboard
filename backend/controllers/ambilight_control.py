from __future__ import annotations

from datetime import datetime, timezone
import json
import socket
from pathlib import Path
from typing import Any

import httpx
import yaml

from backend.config import (
    AMBILIGHT_COMMANDS_DIR,
    AMBILIGHT_CONTROLLER_STATE_PATH,
    AMBILIGHT_FORCE_DAY_FLAG,
    AMBILIGHT_FORCE_NIGHT_FLAG,
    AMBILIGHT_OVERRIDES_PATH,
    AMBILIGHT_PROFILES_PATH,
    AMBILIGHT_STATUS_DIR,
    AMBISYNC_CONFIG_PATH,
)
from backend.controllers.ambilight_profile import set_profile as set_hyte_profile


GOVEE_LAN_PORT = 4003
TV_BRIGHTNESS_VALUES = {"low": 3, "high": 8}
TV_STYLE_PAYLOADS = {
    "vivid": {"styleName": "FOLLOW_VIDEO", "isExpert": False, "menuSetting": "VIVID"},
    "natural": {"styleName": "FOLLOW_VIDEO", "isExpert": False, "menuSetting": "NATURAL"},
}
DEFAULT_STATE = {
    "mode": "auto",
    "profile": "movie",
    "power_state": "on",
    "hyte_mode": "manual",
    "hyte_manual_profile": "punchy",
    "pc_mode": "manual_high",
    "auto_led_scale_pct": 30,
    "last_resolved_profile": "movie_day",
    "last_applied_at": None,
    "last_reason": "init",
}
DEFAULT_PROFILES = {
    "movie_day": {
        "ambilight": {"power": "on", "style": "vivid", "brightness": "high"},
        "hue_action": "movie_day",
        "govee_power": "on",
        "hyte_profile": "punchy",
    },
    "movie_night": {
        "ambilight": {"power": "on", "style": "natural", "brightness": "low"},
        "hue_action": "movie_night",
        "govee_power": "on",
        "hyte_profile": "soft",
    },
    "gaming": {
        "ambilight": {"power": "on", "style": "vivid", "brightness": "high"},
        "hue_action": "scene_gaming",
        "govee_power": "on",
        "hyte_profile": "punchy",
    },
    "reading": {
        "ambilight": {"power": "on", "style": "vivid", "brightness": "high"},
        "hue_action": "scene_reading",
        "govee_power": "on",
        "hyte_profile": "normal",
    },
    "sleep": {
        "ambilight": {"power": "on", "style": "natural", "brightness": "low"},
        "hue_action": "scene_sleep",
        "govee_power": "on",
        "hyte_profile": "soft",
    },
    "off": {
        "ambilight": {"power": "off"},
        "hue_action": "all_off",
        "govee_power": "off",
        "hyte_profile": "soft",
    },
}


def _read_yaml(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    data = yaml.safe_load(path.read_text()) or {}
    return data if isinstance(data, dict) else {}


def _load_sync_config() -> dict[str, Any]:
    return _read_yaml(AMBISYNC_CONFIG_PATH)


def _load_profiles() -> dict[str, dict[str, Any]]:
    raw = _read_yaml(AMBILIGHT_PROFILES_PATH)
    data = raw.get("profiles") if "profiles" in raw else raw
    if not isinstance(data, dict):
        return DEFAULT_PROFILES.copy()
    merged = DEFAULT_PROFILES.copy()
    for key, value in data.items():
        if isinstance(value, dict):
            merged[key] = value
    return merged


def _load_runtime_overrides() -> dict[str, Any]:
    if not AMBILIGHT_OVERRIDES_PATH.exists():
        return {}
    try:
        return json.loads(AMBILIGHT_OVERRIDES_PATH.read_text())
    except json.JSONDecodeError:
        return {}


def _write_runtime_overrides(payload: dict[str, Any]) -> bool:
    try:
        AMBILIGHT_OVERRIDES_PATH.parent.mkdir(parents=True, exist_ok=True)
        AMBILIGHT_OVERRIDES_PATH.write_text(json.dumps(payload) + "\n")
        return True
    except OSError:
        return False


def _infer_state() -> dict[str, Any]:
    state = DEFAULT_STATE.copy()
    if AMBILIGHT_FORCE_NIGHT_FLAG.exists():
        state["mode"] = "night"
    elif AMBILIGHT_FORCE_DAY_FLAG.exists():
        state["mode"] = "day"
    overrides = _load_runtime_overrides()
    led_pct = (
        (overrides.get("night") or {}).get("led_scale_pct")
        if isinstance(overrides.get("night"), dict)
        else None
    )
    if isinstance(led_pct, int):
        if led_pct == 100:
            state["pc_mode"] = "manual_high"
        else:
            state["pc_mode"] = "auto"
            state["auto_led_scale_pct"] = led_pct
    return state


def _load_state() -> dict[str, Any]:
    if not AMBILIGHT_CONTROLLER_STATE_PATH.exists():
        return _infer_state()
    try:
        current = json.loads(AMBILIGHT_CONTROLLER_STATE_PATH.read_text())
    except json.JSONDecodeError:
        return _infer_state()
    state = DEFAULT_STATE.copy()
    if isinstance(current, dict):
        state.update({k: v for k, v in current.items() if k in state})
    return state


def _save_state(state: dict[str, Any]) -> dict[str, Any]:
    AMBILIGHT_CONTROLLER_STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    AMBILIGHT_CONTROLLER_STATE_PATH.write_text(json.dumps(state, indent=2) + "\n")
    return state


def _write_status(name: str, value: str) -> None:
    AMBILIGHT_STATUS_DIR.mkdir(parents=True, exist_ok=True)
    (AMBILIGHT_STATUS_DIR / f"{name}.txt").write_text(f"{value}\n")


def _is_scheduled_night() -> bool:
    overrides = _load_runtime_overrides()
    night_cfg = overrides.get("night") if isinstance(overrides.get("night"), dict) else {}
    start = int(night_cfg.get("start_hour", 22))
    end = int(night_cfg.get("end_hour", 6))
    hour = datetime.now().hour
    return hour >= start or hour < end


def _resolve_profile_name(state: dict[str, Any]) -> str:
    if state.get("power_state") == "off":
        return "off"
    profile = state["profile"]
    if profile != "movie":
        return profile
    if state["mode"] == "night":
        return "movie_night"
    if state["mode"] == "day":
        return "movie_day"
    return "movie_night" if _is_scheduled_night() else "movie_day"


def _effective_hyte_profile(state: dict[str, Any], resolved_profile: str, profiles: dict[str, dict[str, Any]]) -> str:
    if state["hyte_mode"] == "manual":
        return state["hyte_manual_profile"]
    return str(profiles.get(resolved_profile, {}).get("hyte_profile", state["hyte_manual_profile"]))


def _sync_status_files(state: dict[str, Any], resolved_profile: str) -> None:
    profiles = _load_profiles()
    hyte_profile = _effective_hyte_profile(state, resolved_profile, profiles)
    _write_status("ambilight_active_profile", resolved_profile)
    _write_status("ambilight_controller_mode", state["mode"])
    _write_status("ambilight_power_state", str(state["power_state"]))
    _write_status("ambilight_hyte_control", f"{state['hyte_mode']}:{hyte_profile}")
    _write_status("ambilight_pc_control", state["pc_mode"])


def _set_mode_flags(mode: str) -> None:
    if mode == "day":
        AMBILIGHT_FORCE_NIGHT_FLAG.unlink(missing_ok=True)
        AMBILIGHT_FORCE_DAY_FLAG.touch()
        return
    if mode == "night":
        AMBILIGHT_FORCE_DAY_FLAG.unlink(missing_ok=True)
        AMBILIGHT_FORCE_NIGHT_FLAG.touch()
        return
    AMBILIGHT_FORCE_DAY_FLAG.unlink(missing_ok=True)
    AMBILIGHT_FORCE_NIGHT_FLAG.unlink(missing_ok=True)


def _tv_client(tv_cfg: dict[str, Any]) -> httpx.Client:
    return httpx.Client(
        base_url=f"https://{tv_cfg['host']}:1926/6",
        verify=False,
        auth=httpx.DigestAuth(tv_cfg["device_id"], tv_cfg["auth_key"]),
        timeout=3.0,
    )


def _apply_ambilight(tv_cfg: dict[str, Any], payload: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if not tv_cfg:
        return ["missing_tv_config"]
    try:
        with _tv_client(tv_cfg) as client:
            power = payload.get("power", "on")
            client.post("/ambilight/power", json={"power": "On" if power == "on" else "Off"})
            if power == "off":
                return []
            style = payload.get("style")
            if style in TV_STYLE_PAYLOADS:
                client.post("/ambilight/currentconfiguration", json=TV_STYLE_PAYLOADS[style])
            brightness = payload.get("brightness")
            if brightness in TV_BRIGHTNESS_VALUES:
                client.post(
                    "/menuitems/settings/update",
                    json={
                        "values": [
                            {
                                "value": {
                                    "Nodeid": 2130968780,
                                    "Controllable": True,
                                    "Available": True,
                                    "data": {"value": TV_BRIGHTNESS_VALUES[brightness]},
                                }
                            }
                        ]
                    },
                )
    except Exception as exc:  # noqa: BLE001
        errors.append(f"tv:{exc}")
    return errors


def _hue_put(bridge_host: str, token: str, light_id: int, payload: dict[str, Any]) -> None:
    httpx.put(
        f"http://{bridge_host}/api/{token}/lights/{light_id}/state",
        json=payload,
        timeout=2.0,
    )


def _apply_hue_action(hue_cfg: dict[str, Any], action: str) -> list[str]:
    errors: list[str] = []
    if not hue_cfg:
        return ["missing_hue_config"]
    bridge_host = str(hue_cfg["bridge_host"])
    token = str(hue_cfg["token"])
    try:
        if action == "all_off":
            for lid in (1, 2, 3):
                _hue_put(bridge_host, token, lid, {"on": False})
        elif action == "movie_day":
            _hue_put(bridge_host, token, 3, {"on": True})
            for lid in (1, 2):
                _hue_put(bridge_host, token, lid, {"on": True, "bri": 254, "ct": 350})
        elif action == "movie_night":
            _hue_put(bridge_host, token, 3, {"on": True})
            for lid in (1, 2):
                _hue_put(bridge_host, token, lid, {"on": True, "bri": 20, "ct": 454})
        elif action == "scene_gaming":
            _hue_put(bridge_host, token, 3, {"on": True})
            _hue_put(bridge_host, token, 1, {"on": True, "xy": [0.1668, 0.1205], "bri": 180})
            _hue_put(bridge_host, token, 2, {"on": True, "xy": [0.5459, 0.2781], "bri": 180})
        elif action == "scene_reading":
            _hue_put(bridge_host, token, 3, {"on": True})
            for lid in (1, 2):
                _hue_put(bridge_host, token, lid, {"on": True, "bri": 255, "ct": 300})
        elif action == "scene_sleep":
            _hue_put(bridge_host, token, 3, {"on": False})
            for lid in (1, 2):
                _hue_put(bridge_host, token, lid, {"on": True, "bri": 15, "ct": 454})
    except Exception as exc:  # noqa: BLE001
        errors.append(f"hue:{exc}")
    return errors


def _set_govee_power(govee_cfg: dict[str, Any], power: str) -> list[str]:
    if not govee_cfg or not govee_cfg.get("ip"):
        return []
    msg = json.dumps({"msg": {"cmd": "turn", "data": {"value": 1 if power == "on" else 0}}})
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.sendto(msg.encode(), (str(govee_cfg["ip"]), GOVEE_LAN_PORT))
        sock.close()
    except Exception as exc:  # noqa: BLE001
        return [f"govee:{exc}"]
    return []


def _apply_hyte_profile_from_state(state: dict[str, Any], resolved_profile: str, profiles: dict[str, dict[str, Any]]) -> None:
    set_hyte_profile(_effective_hyte_profile(state, resolved_profile, profiles))


def _apply_pc_mode_from_state(state: dict[str, Any], *, persist_runtime: bool) -> None:
    if not persist_runtime:
        return
    overrides = _load_runtime_overrides()
    night_cfg = overrides.setdefault("night", {})
    if state["pc_mode"] == "manual_high":
        current = night_cfg.get("led_scale_pct")
        if isinstance(current, int) and current != 100:
            state["auto_led_scale_pct"] = current
        night_cfg["led_scale_pct"] = 100
    else:
        night_cfg["led_scale_pct"] = int(state.get("auto_led_scale_pct", 30))
    _write_runtime_overrides(overrides)


def _stamp_state(state: dict[str, Any], resolved_profile: str, reason: str) -> dict[str, Any]:
    state["last_resolved_profile"] = resolved_profile
    state["last_reason"] = reason
    state["last_applied_at"] = datetime.now(timezone.utc).isoformat()
    _save_state(state)
    _sync_status_files(state, resolved_profile)
    return state


def get_status() -> dict[str, Any]:
    state = _load_state()
    _save_state(state)
    profiles = _load_profiles()
    resolved_profile = _resolve_profile_name(state)
    _sync_status_files(state, resolved_profile)
    return {
        **state,
        "resolved_profile": resolved_profile,
        "effective_hyte_profile": _effective_hyte_profile(state, resolved_profile, profiles),
    }


def apply_current(reason: str = "manual") -> dict[str, Any]:
    state = _load_state()
    profiles = _load_profiles()
    cfg = _load_sync_config()
    resolved_profile = _resolve_profile_name(state)
    profile_cfg = profiles.get(resolved_profile, {})
    errors: list[str] = []

    _set_mode_flags(state["mode"])
    _apply_pc_mode_from_state(state, persist_runtime=False)
    _apply_hyte_profile_from_state(state, resolved_profile, profiles)

    errors += _apply_ambilight(cfg.get("tv") or {}, profile_cfg.get("ambilight") or {})
    errors += _apply_hue_action(cfg.get("hue") or {}, str(profile_cfg.get("hue_action", "all_off")))
    errors += _set_govee_power(cfg.get("govee") or {}, str(profile_cfg.get("govee_power", "off")))

    _stamp_state(state, resolved_profile, reason)
    return {
        "status": "ok" if not errors else "partial",
        "errors": errors,
        **get_status(),
    }


def set_mode(mode: str) -> dict[str, Any]:
    if mode not in {"auto", "day", "night"}:
        raise ValueError(f"invalid mode: {mode}")
    state = _load_state()
    state["mode"] = mode
    _save_state(state)
    return apply_current(reason=f"mode:{mode}")


def set_profile(profile: str) -> dict[str, Any]:
    if profile not in {"movie", "gaming", "reading", "sleep", "off"}:
        raise ValueError(f"invalid profile: {profile}")
    state = _load_state()
    if profile == "off":
        state["power_state"] = "off"
        _save_state(state)
        return apply_current(reason="profile:off")
    state["profile"] = profile
    state["power_state"] = "on"
    if profile == "sleep":
        state["mode"] = "night"
    _save_state(state)
    return apply_current(reason=f"profile:{profile}")


def bootstrap() -> dict[str, Any]:
    state = _load_state()
    _save_state(state)
    return apply_current(reason="bootstrap")


def set_hyte(mode: str, profile: str | None = None) -> dict[str, Any]:
    if mode not in {"auto", "manual"}:
        raise ValueError(f"invalid hyte mode: {mode}")
    if profile is not None and profile not in {"soft", "normal", "punchy"}:
        raise ValueError(f"invalid hyte profile: {profile}")
    state = _load_state()
    state["hyte_mode"] = mode
    if profile is not None:
        state["hyte_manual_profile"] = profile
    profiles = _load_profiles()
    resolved_profile = _resolve_profile_name(state)
    _apply_hyte_profile_from_state(state, resolved_profile, profiles)
    _stamp_state(state, resolved_profile, f"hyte:{mode}")
    return get_status()


def sync_hyte_from_ha(auto_sync: bool, manual_profile: str) -> dict[str, Any]:
    return set_hyte("auto" if auto_sync else "manual", manual_profile)


def set_power(power: str) -> dict[str, Any]:
    if power not in {"on", "off"}:
        raise ValueError(f"invalid power state: {power}")
    state = _load_state()
    state["power_state"] = power
    _save_state(state)
    return apply_current(reason=f"power:{power}")


def set_pc(mode: str, auto_led_scale_pct: int | None = None) -> dict[str, Any]:
    if mode not in {"auto", "manual_high"}:
        raise ValueError(f"invalid pc mode: {mode}")
    state = _load_state()
    state["pc_mode"] = mode
    if auto_led_scale_pct is not None:
        state["auto_led_scale_pct"] = int(auto_led_scale_pct)
    resolved_profile = _resolve_profile_name(state)
    _stamp_state(state, resolved_profile, f"pc:{mode}")
    return get_status()


def sync_pc_from_ha(auto_sync: bool, auto_led_scale_pct: int) -> dict[str, Any]:
    return set_pc("auto" if auto_sync else "manual_high", auto_led_scale_pct)


def request_sync_restart(action: str) -> dict[str, Any]:
    if action not in {"start", "stop", "restart"}:
        raise ValueError(f"invalid sync action: {action}")
    AMBILIGHT_COMMANDS_DIR.mkdir(parents=True, exist_ok=True)
    cmd_path = AMBILIGHT_COMMANDS_DIR / f"sync_{datetime.now().strftime('%Y%m%d%H%M%S%f')}.cmd"
    cmd_path.write_text(f"ambisync_{action}\n")
    return {"status": "ok", "action": action}
