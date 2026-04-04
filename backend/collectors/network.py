import asyncio
import time

import psutil

from backend.config import NETWORK_INTERFACE

_prev_net = None
_prev_ts = None


async def _run_cmd(cmd: list[str], timeout: float = 5) -> str:
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        return stdout.decode().strip()
    except Exception:
        return ""


async def _get_wifi_info() -> tuple[str, int | None]:
    """SSID + fréquence en un seul appel 'iw dev link' (remplace iwgetid x2)."""
    out = await _run_cmd(["iw", "dev", NETWORK_INTERFACE, "link"])
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


async def _get_signal() -> int | None:
    try:
        content = await asyncio.to_thread(
            lambda: open("/proc/net/wireless").read()
        )
        for line in content.splitlines():
            if NETWORK_INTERFACE in line:
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


async def _get_ip_local() -> str | None:
    addrs = psutil.net_if_addrs().get(NETWORK_INTERFACE, [])
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
    global _prev_net, _prev_ts
    now = time.monotonic()

    net_io = psutil.net_io_counters(pernic=True).get(NETWORK_INTERFACE)

    download_bps = 0
    upload_bps = 0
    if net_io and _prev_net and _prev_ts:
        dt = now - _prev_ts
        if dt > 0:
            download_bps = round((net_io.bytes_sent - _prev_net.bytes_sent) / dt)
            upload_bps = round((net_io.bytes_recv - _prev_net.bytes_recv) / dt)
            download_bps, upload_bps = upload_bps, download_bps

    if net_io:
        _prev_net = net_io
        _prev_ts = now

    # Tout en parallèle : iw link (SSID+freq), signal /proc, ping, IP locale, IP publique, tailscale
    (ssid, freq), signal, ping, ip_local, ip_public, tailscale = await asyncio.gather(
        _get_wifi_info(), _get_signal(), _get_ping(),
        _get_ip_local(), _get_ip_public(), _get_tailscale()
    )

    signal_percent = min(max((signal + 100) * 2, 0), 100) if signal is not None else None

    return {
        "ssid": ssid or "Disconnected",
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
    current_ssid, _ = await _get_wifi_info()

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
