import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.config import FRONTEND_DIR, WALLPAPERS_DIR
from backend.scheduler import Scheduler
from backend.collectors import gpu

logging.basicConfig(level=logging.WARNING)

scheduler = Scheduler()


async def _ensure_wallpaper():
    """Generate current.png from first available wallpaper if missing."""
    current = WALLPAPERS_DIR / "current.png"
    if current.exists():
        return
    for f in sorted(WALLPAPERS_DIR.iterdir()):
        if f.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp") and f.name != "current.png":
            from backend.controllers.wallpaper import change_wallpaper
            await change_wallpaper(f.name)
            break


@asynccontextmanager
async def lifespan(app: FastAPI):
    gpu.init()
    await _ensure_wallpaper()
    scheduler.start()
    yield
    scheduler.stop()
    gpu.shutdown()


app = FastAPI(lifespan=lifespan)


@app.get("/")
async def index():
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    scheduler.clients.add(ws)
    try:
        snapshot = await scheduler.get_snapshot()
        for msg in snapshot:
            await ws.send_text(msg)
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        scheduler.clients.discard(ws)


# Controllers - REST endpoints
from fastapi import Body


@app.get("/api/wallpapers")
async def list_wallpapers():
    if not WALLPAPERS_DIR.exists():
        return []
    return [f.name for f in WALLPAPERS_DIR.iterdir()
            if f.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp")]


@app.post("/api/leds")
async def set_leds(data: dict = Body(...)):
    from backend.controllers.leds import set_color, turn_off, set_effect
    if data.get("preset") == "off":
        await turn_off()
        return {"status": "ok"}
    if data.get("effect"):
        r = data.get("r", 255)
        g = data.get("g", 255)
        b = data.get("b", 255)
        await set_effect(data["effect"], r, g, b)
        return {"status": "ok"}
    r, g, b = data.get("r", 255), data.get("g", 255), data.get("b", 255)
    await set_color(r, g, b)
    return {"status": "ok"}


@app.post("/api/screen")
async def screen_control(data: dict = Body(...)):
    from backend.controllers.screen import screen_on, screen_off
    action = data.get("action")
    if action == "off":
        await screen_off()
    elif action == "on":
        await screen_on()
    return {"status": "ok"}


@app.post("/api/screen/brightness")
async def screen_brightness(data: dict = Body(...)):
    from backend.controllers.screen import set_brightness
    level = int(data.get("level", 80))
    await set_brightness(level)
    return {"status": "ok", "level": level}


@app.get("/api/leds/status")
async def leds_status():
    from backend.controllers.leds import get_status
    return get_status()


@app.post("/api/desktop-mode")
async def desktop_mode(data: dict = Body(...)):
    """Signale au webview de basculer en mode bureau ou de revenir."""
    import pathlib
    action = data.get("action", "enter")
    signal_file = pathlib.Path("/tmp/hyte-desktop-mode")
    if action == "enter":
        signal_file.write_text("enter")
    elif action == "exit":
        signal_file.write_text("exit")
    return {"status": "ok"}


@app.post("/api/wallpaper")
async def change_wallpaper(data: dict = Body(...)):
    from backend.controllers.wallpaper import change_wallpaper
    name = data.get("name", "")
    await change_wallpaper(name)
    return {"status": "ok"}


@app.post("/api/wifi/connect")
async def wifi_connect(data: dict = Body(...)):
    import asyncio
    ssid = data.get("ssid", "")
    password = data.get("password", "")
    cmd = ["nmcli", "dev", "wifi", "connect", ssid]
    if password:
        cmd += ["password", password]
    proc = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode == 0:
        return {"status": "ok"}
    return {"status": "error", "message": stderr.decode().strip()}


@app.post("/api/services/{name}")
async def service_control(name: str, data: dict = Body(...)):
    from backend.controllers.services import control_service
    action = data.get("action", "")
    result = await control_service(name, action)
    return result


@app.get("/api/ollama/models")
async def ollama_models():
    """Liste les modèles disponibles sur Ollama."""
    try:
        import httpx
        async with httpx.AsyncClient(timeout=3) as client:
            resp = await client.get("http://localhost:11434/api/tags")
            data = resp.json()
            models = [m["name"] for m in data.get("models", [])]
            return {"models": models}
    except Exception:
        return {"models": []}


@app.post("/api/ollama/chat")
async def ollama_chat(data: dict = Body(...)):
    """Envoie un message à Ollama et stream la réponse via SSE."""
    import httpx
    import json
    from fastapi.responses import StreamingResponse

    model = data.get("model", "llama3")
    messages = data.get("messages", [])

    async def stream_response():
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                async with client.stream(
                    "POST",
                    "http://localhost:11434/api/chat",
                    json={"model": model, "messages": messages, "stream": True},
                ) as resp:
                    async for line in resp.aiter_lines():
                        if not line:
                            continue
                        try:
                            chunk = json.loads(line)
                            content = chunk.get("message", {}).get("content", "")
                            done = chunk.get("done", False)
                            yield f"data: {json.dumps({'content': content, 'done': done})}\n\n"
                            if done:
                                break
                        except Exception:
                            continue
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"

    return StreamingResponse(
        stream_response(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# Serve static files (CSS, JS)
app.mount("/css", StaticFiles(directory=str(FRONTEND_DIR / "css")), name="css")
app.mount("/js", StaticFiles(directory=str(FRONTEND_DIR / "js")), name="js")
app.mount("/wallpapers", StaticFiles(directory=str(WALLPAPERS_DIR)), name="wallpapers")
