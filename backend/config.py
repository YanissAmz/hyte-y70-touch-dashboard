import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
WALLPAPERS_DIR = BASE_DIR / "wallpapers"

HOST = "127.0.0.1"
PORT = 8070

NETWORK_INTERFACE = "wlp13s0"
WEATHER_CITY = "Evry"
SERIAL_DEVICE = "/dev/ttyACM0"
SERIAL_BAUD = 2_000_000
LED_CHANNELS = [1, 2, 3]
LED_COUNT = 100

DISPLAY = os.environ.get("DISPLAY", ":0")

# Collector intervals in seconds
INTERVALS = {
    "cpu": 2,
    "memory": 2,
    "gpu": 3,
    "network": 3,
    "disk": 30,
    "wifi_scan": 60,
    "weather": 900,
    "system": 30,
    "processes": 3,
}

# Hardware specs (for display)
HW_CPU_MODEL = "AMD Ryzen 9 7950X"
HW_GPU_MODEL = "NVIDIA GeForce RTX 3090"
HW_RAM_MODEL = "DDR5 32GB"
HW_DISK_MODEL = "WD_BLACK SN850X 1TB"


def _find_hwmon(name: str) -> str | None:
    hwmon_base = Path("/sys/class/hwmon")
    if not hwmon_base.exists():
        return None
    for hwmon_dir in hwmon_base.iterdir():
        name_file = hwmon_dir / "name"
        if name_file.exists() and name_file.read_text().strip() == name:
            return str(hwmon_dir)
    return None


def get_hwmon_paths() -> dict[str, str | None]:
    return {
        "cpu_temp": _find_hwmon("k10temp"),
        "nvme_temp": _find_hwmon("nvme"),
        "gpu_temp": _find_hwmon("amdgpu"),
    }


HWMON = get_hwmon_paths()
