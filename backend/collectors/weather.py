import time

from backend.config import WEATHER_CITY

_cache = None
_cache_ts = 0
_CACHE_TTL = 900


async def collect() -> dict:
    global _cache, _cache_ts
    now = time.time()

    if _cache and (now - _cache_ts) < _CACHE_TTL:
        return _cache

    try:
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"https://wttr.in/{WEATHER_CITY}?format=%t+%C")
            text = resp.text.strip()
            parts = text.split(" ", 1)
            temp = parts[0] if parts else "--"
            condition = parts[1] if len(parts) > 1 else ""

            icons = {
                "Clear": "\u2600\ufe0f", "Sunny": "\u2600\ufe0f",
                "Partly": "\u26c5", "Cloudy": "\u2601\ufe0f", "Overcast": "\u2601\ufe0f",
                "Rain": "\ud83c\udf27\ufe0f", "Drizzle": "\ud83c\udf27\ufe0f",
                "Thunder": "\u26c8\ufe0f", "Snow": "\u2744\ufe0f",
                "Fog": "\ud83c\udf2b\ufe0f", "Mist": "\ud83c\udf2b\ufe0f",
            }
            icon = "\ud83c\udf24\ufe0f"
            for key, val in icons.items():
                if key.lower() in condition.lower():
                    icon = val
                    break

            _cache = {"temp": temp, "condition": condition, "icon": icon}
            _cache_ts = now
            return _cache
    except Exception:
        return _cache or {"temp": "--", "condition": "", "icon": ""}
