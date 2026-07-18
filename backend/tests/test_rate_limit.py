import uuid

import pytest

from auth import ApiError
from rate_limit import RATE_LIMITED_MESSAGE, RateLimiter


def test_rate_limiter_allows_requests_under_limit() -> None:
    """Allow requests while the user remains below the configured limit."""
    limiter = RateLimiter(max_requests=3, window_seconds=60)
    user_id = uuid.uuid4()

    limiter.check(user_id, now=10.0)
    limiter.check(user_id, now=20.0)
    limiter.check(user_id, now=30.0)


def test_rate_limiter_rejects_requests_over_limit() -> None:
    """Raise the documented 429 ApiError when the window is full."""
    limiter = RateLimiter(max_requests=2, window_seconds=60)
    user_id = uuid.uuid4()

    limiter.check(user_id, now=10.0)
    limiter.check(user_id, now=20.0)

    with pytest.raises(ApiError) as error_info:
        limiter.check(user_id, now=30.0)

    error = error_info.value
    assert error.status_code == 429
    assert error.code == "rate_limited"
    assert error.message == RATE_LIMITED_MESSAGE


def test_rate_limiter_tracks_users_independently() -> None:
    """Do not let one user's scans consume another user's allowance."""
    limiter = RateLimiter(max_requests=1, window_seconds=60)
    first_user_id = uuid.uuid4()
    second_user_id = uuid.uuid4()

    limiter.check(first_user_id, now=10.0)
    limiter.check(second_user_id, now=10.0)

    with pytest.raises(ApiError):
        limiter.check(first_user_id, now=20.0)


def test_rate_limiter_allows_requests_after_window_reset() -> None:
    """Allow a user again after all earlier scans have aged out."""
    limiter = RateLimiter(max_requests=2, window_seconds=60)
    user_id = uuid.uuid4()

    limiter.check(user_id, now=10.0)
    limiter.check(user_id, now=20.0)
    limiter.check(user_id, now=80.0)
    limiter.check(user_id, now=81.0)
