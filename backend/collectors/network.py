import asyncio
import time

import psutil

from backend.config import NETWORK_INTERFACE as _FALLBACK_IFACE

_prev_net = None
_prev_ts = None

# Per-interface byte counters so switching interfaces doesn't break throughput calc.
_prev_counters: dict = {}


def _detect_active_interface() -> str:
    """Pick the active network interface. Priority:
       1. Ethernet (en*/eth*) UP with a non-link-local IPv4.
       2. WiFi (wl*) UP with a non-link-local IPv4.
       3. Fallback to config NETWORK_INTERFACE.
    """
    stats = psutil.net_if_stats()
    addrs = psutil.net_if_addrs()
    candidates_eth = []
    candidates_wifi = []
    for name, st in stats.items():
        if not st.isup or name == "lo" or name.startswith(("docker", "br-", "veth", "tailscale")):
            continue
        ips = [a.address for a in addrs.get(name, []) if a.family.name == "AF_INET" and not a.address.startswith("169.254.")]
        if not ips:
            continue
        if name.startswith(("en", "eth")):
            candidates_eth.append(name)
        elif name.startswith(("wl", "wlan")):
            candidates_wifi.append(name)
    if candidates_eth:
        return candidates_eth[0]
    if candidates_wifi:
        return candidates_wifi[0]
    return _FALLBACK_IFACE


def _is_wireless(iface: str) -> bool:
    return iface.startswith(("wl", "wlan"))


def _link_speed_mbps(iface: str) -> int | None:
    try:
        with open(f"/sys/class/net/{iface}/speed") as f:
            return int(f.read().strip())
    except Exception:
        return None


async def _run_cmd(cmd: list[str], timeout: float = 5) -> str:
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        return stdout.decode().strip()
    except Exception:
        return ""


async def _get_wifi_info(iface: str) -> tuple[str, int | None]:
    """SSID + fréquence via 'iw dev link'. Retourne ("", None) si pas wifi."""
    if not _is_wireless(iface):
        return "", None
    out = await _run_cmd(["iw", "dev", iface, "link"])
    ssid = ""
    freq = None
    for line in out.splitlines():
        line = line.strip()
        if line.startswith("SSID:"):
            ssid = line[5:].strip()
        elif line.startswith("freq:"):
            try:
                freq = int(line.split(":")[1].strip())
            except Exception:
                pass
    return ssid, freq


async def _get_signal(iface: str) -> int | None:
    if not _is_wireless(iface):
        return None
    try:
        content = await asyncio.to_thread(
            lambda: open("/proc/net/wireless").read()
        )
        for line in content.splitlines():
            if iface in line:
                parts = line.split()
                return int(float(parts[2].rstrip(".")))
    except Exception:
        pass
    return None


async def _get_ping() -> float | None:
    out = await _run_cmd(["ping", "-c", "1", "-W", "2", "8.8.8.8"])
    if "time=" in out:
        try:
            return float(out.split("time=")[1].split()[0])
        except Exception:
            pass
    return None


async def _get_ip_local(iface: str) -> str | None:
    addrs = psutil.net_if_addrs().get(iface, [])
    for addr in addrs:
        if addr.family.name == "AF_INET":
            return addr.address
    return None


_ip_public_cache = None
_ip_public_ts = 0


async def _get_ip_public() -> str | None:
    global _ip_public_cache, _ip_public_ts
    now = time.time()
    if _ip_public_cache and (now - _ip_public_ts) < 300:
        return _ip_public_cache
    try:
        import httpx
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get("https://api.ipify.org")
            _ip_public_cache = resp.text.strip()
            _ip_public_ts = now
            return _ip_public_cache
    except Exception:
        return _ip_public_cache


_tailscale_cache: dict | None = None
_tailscale_ts = 0
_TAILSCALE_TTL = 60


async def _get_tailscale() -> dict:
    global _tailscale_cache, _tailscale_ts
    now = time.time()
    if _tailscale_cache is not None and (now - _tailscale_ts) < _TAILSCALE_TTL:
        return _tailscale_cache
    out = await _run_cmd(["tailscale", "status", "--json"])
    result: dict = {"status": "disconnected", "ip": None}
    if out:
        try:
            import json
            data = json.loads(out)
            self_node = data.get("Self", {})
            if isinstance(self_node, dict):
                ts_ips = self_node.get("TailscaleIPs", [])
                result = {"status": "connected", "ip": ts_ips[0] if ts_ips else None}
        except Exception:
            pass
    _tailscale_cache = result
    _tailscale_ts = now
    return result


async def collect() -> dict:
    global _prev_ts
    now = time.monotonic()

    iface = _detect_active_interface()
    iface_type = "wifi" if _is_wireless(iface) else "ethernet"
    net_io = psutil.net_io_counters(pernic=True).get(iface)

    download_bps = 0
    upload_bps = 0
    prev = _prev_counters.get(iface)
    if net_io and prev and _prev_ts:
        dt = now - _prev_ts
        if dt > 0:
            # psutil: bytes_sent = TX (upload), bytes_recv = RX (download).
            download_bps = round((net_io.bytes_recv - prev.bytes_recv) / dt)
            upload_bps   = round((net_io.bytes_sent - prev.bytes_sent) / dt)

    if net_io:
        _prev_counters[iface] = net_io
        _prev_ts = now

    (ssid, freq), signal, ping, ip_local, ip_public, tailscale = await asyncio.gather(
        _get_wifi_info(iface), _get_signal(iface), _get_ping(),
        _get_ip_local(iface), _get_ip_public(), _get_tailscale()
    )

    signal_percent = min(max((signal + 100) * 2, 0), 100) if signal is not None else None

    # For ethernet we surface the interface name in the "ssid" slot so the UI
    # has a single field to display (keeps the frontend simple).
    display_name = ssid if (iface_type == "wifi" and ssid) else f"Ethernet · {iface}" if iface_type == "ethernet" else "Disconnected"

    return {
        "ssid": display_name,
        "iface": iface,
        "iface_type": iface_type,
        "link_speed_mbps": _link_speed_mbps(iface),
        "signal_dbm": signal,
        "signal_percent": signal_percent,
        "frequency_mhz": freq,
        "ip_local": ip_local,
        "ip_public": ip_public,
        "download_bps": download_bps,
        "upload_bps": upload_bps,
        "ping_ms": ping,
        "tailscale": tailscale,
    }


async def collect_wifi_scan() -> dict:
    out = await _run_cmd([
        "nmcli", "-t", "-f", "SSID,SIGNAL,FREQ,SECURITY", "dev", "wifi", "list"
    ], timeout=10)

    networks = []
    seen = set()
    iface = _detect_active_interface()
    current_ssid, _ = await _get_wifi_info(iface)

    for line in out.splitlines():
        parts = line.split(":")
        if len(parts) >= 4:
            ssid = parts[0].strip()
            if not ssid or ssid in seen:
                continue
            seen.add(ssid)
            try:
                signal = int(parts[1])
            except ValueError:
                signal = 0
            freq_str = parts[2].strip()
            freq_band = "5 GHz" if "5" in freq_str and int(freq_str.split()[0]) > 3000 else "2.4 GHz"
            security = parts[3].strip() if parts[3].strip() else "Open"
            networks.append({
                "ssid": ssid,
                "signal_percent": signal,
                "frequency": freq_band,
                "security": security,
                "connected": ssid == current_ssid,
            })

    networks.sort(key=lambda n: n["signal_percent"], reverse=True)
    return {"networks": networks}
