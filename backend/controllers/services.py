import asyncio


ALLOWED_SERVICES = {"ollama"}


async def control_service(name: str, action: str) -> dict:
    if action not in ("start", "stop", "restart"):
        return {"status": "error", "message": f"Invalid action: {action}"}

    if name in ALLOWED_SERVICES:
        proc = await asyncio.create_subprocess_exec(
            "sudo", "systemctl", action, name,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        _, stderr = await proc.communicate()
        if proc.returncode == 0:
            return {"status": "ok"}
        return {"status": "error", "message": stderr.decode().strip()}

    if name.startswith("docker:"):
        container = name.split(":", 1)[1]
        docker_action = "start" if action == "start" else "stop"
        proc = await asyncio.create_subprocess_exec(
            "docker", docker_action, container,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        _, stderr = await proc.communicate()
        if proc.returncode == 0:
            return {"status": "ok"}
        return {"status": "error", "message": stderr.decode().strip()}

    return {"status": "error", "message": f"Unknown service: {name}"}
