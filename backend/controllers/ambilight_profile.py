from __future__ import annotations

from pathlib import Path


STATE_FILE = Path("/tmp/hyte-ambilight-profile")
VALID_PROFILES = {"soft", "normal", "punchy"}


def normalize_profile(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip().lower()
    return value if value in VALID_PROFILES else None


def get_profile() -> str | None:
    try:
        return normalize_profile(STATE_FILE.read_text())
    except OSError:
        return None


def set_profile(profile: str) -> str:
    normalized = normalize_profile(profile)
    if normalized is None:
        raise ValueError(f"invalid ambilight profile: {profile}")
    STATE_FILE.write_text(normalized + "\n")
    return normalized
