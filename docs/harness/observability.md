# Observability Harness

Agents need runtime signals they can inspect without guessing.

## Current State

- API health endpoints are documented in `../ARCHITECTURE.md`.
- Local request logging exists in the API.
- No local metrics or tracing stack is required for the current V1 workflow.

## Target State

- API logs should be structured enough to search by method, route, status, duration, and request id.
- Browser-to-API journeys should propagate a request id when practical.
- Future observability scripts should write artifacts under ignored `output/` paths.
- Add metrics or traces only when logs and tests are insufficient for the question being validated.

