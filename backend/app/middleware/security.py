import time
from collections import defaultdict, deque
from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        if request.url.path in {"/docs", "/redoc"} or request.url.path.startswith("/docs/"):
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                "img-src 'self' data: https://fastapi.tiangolo.com; "
                "font-src 'self' https://cdn.jsdelivr.net; "
                "frame-ancestors 'none'; object-src 'none'"
            )
        else:
            response.headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none'; object-src 'none'"
        if settings.cookie_secure:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


class BruteForceMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.attempts: dict[str, deque[float]] = defaultdict(deque)
        self.blocked_until: dict[str, float] = {}

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        protected_paths = {"/api/auth/login", "/api/auth/forgot-password"}
        if request.method == "POST" and request.url.path in protected_paths:
            ip = request.client.host if request.client else "unknown"
            now = time.time()
            window = settings.brute_force_window_minutes * 60
            if self.blocked_until.get(ip, 0) > now:
                retry_after = int(self.blocked_until[ip] - now)
                return Response("Too many attempts", status_code=429, headers={"Retry-After": str(retry_after)})
            bucket = self.attempts[ip]
            while bucket and bucket[0] < now - window:
                bucket.popleft()
            if len(bucket) >= settings.brute_force_max_attempts:
                self.blocked_until[ip] = now + window
                return Response("Too many attempts", status_code=429, headers={"Retry-After": str(int(window))})
            response = await call_next(request)
            if response.status_code in {400, 401, 403, 404, 409, 422}:
                bucket.append(now)
            return response
        return await call_next(request)


class CSRFMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        if request.method in {"POST", "PUT", "PATCH", "DELETE"} and request.url.path.startswith("/api/"):
            origin = request.headers.get("origin")
            if origin and origin not in settings.cors_origin_list:
                return Response("Invalid CSRF origin", status_code=403)
        return await call_next(request)
