from __future__ import annotations

import asyncio
import os
import time
import uuid
from collections import defaultdict, deque
from collections.abc import Callable

from auth import ApiError

DEFAULT_SCAN_RATE_LIMIT_MAX = 10
DEFAULT_SCAN_RATE_LIMIT_WINDOW_SECONDS = 60
RATE_LIMITED_MESSAGE = "You're scanning too quickly. Wait a moment and try again."


def get_env_int(name: str, default: int) -> int:
    """Read a positive integer from the environment with a documented fallback."""
    raw_value = os.getenv(name)
    if raw_value is None or raw_value == "":
        return default

    try:
        value = int(raw_value)
    except ValueError as error:
        raise ApiError(
            status_code=500,
            code="internal_error",
            message=f"{name} must be an integer.",
        ) from error

    if value <= 0:
        raise ApiError(
            status_code=500,
            code="internal_error",
            message=f"{name} must be greater than zero.",
        )

    return value


class RateLimiter:
    """Track per-user rolling-window request counts in memory."""

    def __init__(
        self,
        max_requests: int,
        window_seconds: int,
        now: Callable[[], float] | None = None,
    ) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.now = now or time.monotonic
        self._timestamps_by_user: dict[str, deque[float]] = defaultdict(deque)

    def check(self, user_id: str | uuid.UUID, now: float | None = None) -> None:
        """Record one request or raise when the user has exceeded the limit."""
        current_time = self.now() if now is None else now
        user_key = str(user_id)
        cutoff = current_time - self.window_seconds
        timestamps = self._timestamps_by_user[user_key]

        while timestamps and timestamps[0] <= cutoff:
            timestamps.popleft()

        if len(timestamps) >= self.max_requests:
            self.prune(current_time)
            raise ApiError(
                status_code=429,
                code="rate_limited",
                message=RATE_LIMITED_MESSAGE,
            )

        timestamps.append(current_time)
        self.prune(current_time)

    def prune(self, now: float | None = None) -> None:
        """Drop stale per-user buckets so the in-memory store stays bounded."""
        current_time = self.now() if now is None else now
        cutoff = current_time - self.window_seconds

        for user_key in list(self._timestamps_by_user):
            timestamps = self._timestamps_by_user[user_key]
            while timestamps and timestamps[0] <= cutoff:
                timestamps.popleft()
            if not timestamps:
                del self._timestamps_by_user[user_key]


scan_rate_limiter = RateLimiter(
    max_requests=get_env_int("SCAN_RATE_LIMIT_MAX", DEFAULT_SCAN_RATE_LIMIT_MAX),
    window_seconds=get_env_int(
        "SCAN_RATE_LIMIT_WINDOW_SECONDS",
        DEFAULT_SCAN_RATE_LIMIT_WINDOW_SECONDS,
    ),
)
scan_rate_limit_lock = asyncio.Lock()


async def check_scan_rate_limit(user_id: uuid.UUID) -> None:
    """Apply the scan endpoint's per-user in-process rate limit."""
    # This is intentionally process-local. Multi-worker or multi-instance
    # deployments need a shared store such as Redis to enforce one global limit.
    async with scan_rate_limit_lock:
        scan_rate_limiter.check(user_id)
