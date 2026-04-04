import asyncio
import json
import time
import logging

from backend.config import INTERVALS

logger = logging.getLogger("dashboard.scheduler")


class Scheduler:
    def __init__(self):
        self.clients: set = set()
        self._tasks: list[asyncio.Task] = []

    async def broadcast(self, msg_type: str, data: dict):
        message = json.dumps({"type": msg_type, "ts": time.time(), "data": data})
        dead = set()
        for ws in self.clients:
            try:
                await ws.send_text(message)
            except Exception:
                dead.add(ws)
        self.clients -= dead

    async def _collector_loop(self, name: str, collect_fn, interval: float):
        while True:
            try:
                data = await collect_fn()
                await self.broadcast(name, data)
            except Exception as e:
                logger.warning(f"Collector {name} error: {e}")
            await asyncio.sleep(interval)

    def start(self):
        from backend.collectors import cpu, memory, gpu, disk, network, weather, processes, system_info, ollama, notifications

        # Démarrer le monitor de notifications (push uniquement, pas de polling)
        asyncio.create_task(notifications.start_monitor(self.broadcast))

        collectors = {
            "cpu": cpu.collect,
            "memory": memory.collect,
            "gpu": gpu.collect,
            "disk": disk.collect,
            "network": network.collect,
            "wifi_scan": network.collect_wifi_scan,
            "weather": weather.collect,
            "processes": processes.collect,
            "system": system_info.collect,
            "ollama": ollama.collect,
        }

        for name, fn in collectors.items():
            interval = INTERVALS.get(name, 10)
            task = asyncio.create_task(self._collector_loop(name, fn, interval))
            self._tasks.append(task)

    def stop(self):
        for task in self._tasks:
            task.cancel()
        self._tasks.clear()

    async def get_snapshot(self) -> list[str]:
        from backend.collectors import cpu, memory, gpu, disk, network, weather, processes, system_info, ollama, notifications

        collectors = {
            "cpu": cpu.collect,
            "memory": memory.collect,
            "gpu": gpu.collect,
            "disk": disk.collect,
            "network": network.collect,
            "weather": weather.collect,
            "system": system_info.collect,
            "ollama": ollama.collect,
            "notifications": notifications.collect,
        }

        names = list(collectors.keys())
        fns = list(collectors.values())

        results = await asyncio.gather(*[fn() for fn in fns], return_exceptions=True)

        messages = []
        for name, result in zip(names, results):
            if isinstance(result, Exception):
                logger.warning(f"Snapshot {name} error: {result}")
            else:
                messages.append(json.dumps({"type": name, "ts": time.time(), "data": result}))
        return messages
