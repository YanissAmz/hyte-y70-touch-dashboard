import httpx


async def collect() -> dict:
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            ps_resp = await client.get("http://localhost:11434/api/ps")
            ps_data = ps_resp.json()
            models = ps_data.get("models", [])
            if models:
                model = models[0]
                return {
                    "running": True,
                    "model": model.get("name", "unknown"),
                    "size_gb": round(model.get("size", 0) / (1024 ** 3), 1),
                    "status": "loaded",
                }
            return {"running": True, "model": None, "status": "idle"}
    except Exception:
        return {"running": False, "model": None, "status": "offline"}
