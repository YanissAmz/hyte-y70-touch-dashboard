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


@asynccontextmanager
async def lifespan(app: FastAPI):
    gpu.init()
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
    from backend.controllers.leds import set_color, turn_off
    if data.get("preset") == "off":
        await turn_off()
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


# Serve static files (CSS, JS)
app.mount("/css", StaticFiles(directory=str(FRONTEND_DIR / "css")), name="css")
app.mount("/js", StaticFiles(directory=str(FRONTEND_DIR / "js")), name="js")
app.mount("/wallpapers", StaticFiles(directory=str(WALLPAPERS_DIR)), name="wallpapers")
