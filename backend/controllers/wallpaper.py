import asyncio

from backend.config import WALLPAPERS_DIR, BASE_DIR


async def change_wallpaper(name: str):
    source = WALLPAPERS_DIR / name
    if not source.exists():
        return
    dest = WALLPAPERS_DIR / "current.png"
    proc = await asyncio.create_subprocess_exec(
        "convert", str(source),
        "-resize", "1100x3840^",
        "-gravity", "center",
        "-extent", "1100x3840",
        "-brightness-contrast", "-40x-10",
        str(dest),
        stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL
    )
    await proc.communicate()
