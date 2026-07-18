# Preeve — Deployment Notes

**Status:** v1.0 — Backend runtime configuration notes for deployment.

## Backend Environment Variables

- `SCAN_RATE_LIMIT_MAX`
  Default: `10`.
  Maximum scan requests per authenticated user inside the rolling window.
- `SCAN_RATE_LIMIT_WINDOW_SECONDS`
  Default: `60`.
  Rolling scan-rate window length in seconds.

The scan endpoint rate limit is enforced in memory by each backend process. A
single backend worker or instance enforces the documented 10-per-60s default
per user. If the backend is scaled to multiple uvicorn workers or multiple
instances, each process keeps its own counter, so a shared store such as Redis
would be required to enforce one global limit.
