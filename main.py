import asyncio
import json
import os
import shutil
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
API_HOST = "127.0.0.1"
API_PORT = int(os.environ.get("NUTRIDORM_PHP_PORT", "8001"))
API_URL = f"http://{API_HOST}:{API_PORT}"
HOP_BY_HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
}


def php_executable() -> str:
    configured_php = os.environ.get("PHP_CLI")
    if configured_php:
        return configured_php

    xampp_php = Path(r"C:\xampp\php\php.exe")
    if xampp_php.is_file():
        return str(xampp_php)

    php = shutil.which("php")
    if php:
        return php

    raise RuntimeError("PHP CLI not found. Install XAMPP PHP or set PHP_CLI to php.exe.")


def api_is_ready() -> bool:
    try:
        with urllib.request.urlopen(f"{API_URL}/api/health", timeout=1) as response:
            result = json.loads(response.read())
        return response.status == 200 and result.get("database") == "connected"
    except (OSError, ValueError, urllib.error.URLError):
        return False


def forward_request(method: str, url: str, headers: list[tuple[bytes, bytes]], body: bytes) -> tuple[int, list[tuple[bytes, bytes]], bytes]:
    request_headers = {
        key.decode("latin-1"): value.decode("latin-1")
        for key, value in headers
        if key.decode("latin-1").lower() not in HOP_BY_HOP_HEADERS | {"host", "content-length"}
    }
    request = urllib.request.Request(url, data=body if method not in {"GET", "HEAD"} else None, headers=request_headers, method=method)

    try:
        response = urllib.request.urlopen(request, timeout=60)
    except urllib.error.HTTPError as error:
        response = error

    with response:
        response_headers = [
            (name.lower().encode("latin-1"), value.encode("latin-1"))
            for name, value in response.headers.items()
            if name.lower() not in HOP_BY_HOP_HEADERS
        ]
        return response.status, response_headers, response.read()


class NutriDormASGI:
    def __init__(self) -> None:
        self.php_process: subprocess.Popen[bytes] | None = None

    async def __call__(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
        if scope["type"] == "lifespan":
            await self.run_lifespan(receive, send)
            return

        if scope["type"] != "http":
            return

        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            body.extend(message.get("body", b""))
            if not message.get("more_body", False):
                break

        raw_path = scope.get("raw_path", scope["path"].encode("utf-8")).decode("latin-1")
        query = scope.get("query_string", b"").decode("latin-1")
        url = f"{API_URL}{raw_path}" + (f"?{query}" if query else "")
        try:
            status, headers, response_body = await asyncio.to_thread(
                forward_request,
                scope["method"],
                url,
                scope.get("headers", []),
                bytes(body),
            )
        except (OSError, urllib.error.URLError) as error:
            status = 502
            headers = [(b"content-type", b"application/json; charset=utf-8")]
            response_body = json.dumps(
                {"detail": f"The PHP API server is unavailable: {error}"},
                ensure_ascii=False,
            ).encode("utf-8")

        await send({"type": "http.response.start", "status": status, "headers": headers})
        await send({"type": "http.response.body", "body": response_body})

    async def run_lifespan(self, receive: Any, send: Any) -> None:
        while True:
            message = await receive()
            if message["type"] == "lifespan.startup":
                try:
                    self.start_php_api()
                except Exception as error:
                    await send({"type": "lifespan.startup.failed", "message": str(error)})
                    return
                await send({"type": "lifespan.startup.complete"})
            elif message["type"] == "lifespan.shutdown":
                self.stop_php_api()
                await send({"type": "lifespan.shutdown.complete"})
                return

    def start_php_api(self) -> None:
        if api_is_ready():
            return

        self.php_process = subprocess.Popen(
            [
                php_executable(),
                "-S",
                f"{API_HOST}:{API_PORT}",
                "-t",
                str(ROOT / "api"),
                str(ROOT / "api" / "router.php"),
            ],
            cwd=ROOT,
        )

        for _ in range(50):
            if self.php_process.poll() is not None:
                raise RuntimeError(f"PHP API server exited with code {self.php_process.returncode}.")
            if api_is_ready():
                return
            time.sleep(0.2)

        self.stop_php_api()
        raise RuntimeError(f"PHP API did not become ready at {API_URL}/api/health. Check MySQL and .env.")

    def stop_php_api(self) -> None:
        if self.php_process is not None and self.php_process.poll() is None:
            self.php_process.terminate()
            try:
                self.php_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.php_process.kill()
                self.php_process.wait()
        self.php_process = None


app = NutriDormASGI()
