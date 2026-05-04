# calc-service

Python 3.12 + FastAPI calculation microservice for the CEMS platform.

Internal-only (Azure VNet ingress) — never exposed to the public internet. Called by the Node.js API at `apps/api/src/lib/calc-service-client.ts` over HTTP with a 30s timeout and circuit breaker.

## Endpoints

| Method | Path | Purpose | Real impl story |
|---|---|---|---|
| `GET` | `/health` | Liveness — returns `{status, version}`. Public via Container Apps `livenessProbe`. | (live) |
| `POST` | `/calculate/ecm` | ECM refrigeration savings (FR16). Stub today. | 8.1 |
| `POST` | `/calculate/baseline` | Energy baseline CDD/HDD regression (FR17). Stub today. | 8.2 |
| `POST` | `/calculate/refrigerant` | Refrigerant temp-to-pressure (FR18). Stub today. | 8.3 |

All endpoints reject unknown fields (Pydantic `extra='forbid'`).

## Running locally

```bash
cd apps/calc-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pnpm dev   # = uvicorn app.main:app --reload --port 8000
```

Then in another shell:

```bash
curl -fsS http://localhost:8000/health
# → {"status":"ok","version":"0.0.1"}

curl -fsS -X POST -H 'content-type: application/json' \
  -d '{"refrigerant_type":"R-404A","temperature_f":40}' \
  http://localhost:8000/calculate/refrigerant
```

## Testing

```bash
pnpm test                # = pytest
# Currently: 12 tests pass — health (1), ECM (2), baseline (2), refrigerant (4), error handler (3)
```

The Node API also has 2 dedicated tests for the calc-service HTTP client + circuit breaker — `apps/api/src/lib/calc-service-client.test.ts`. Those exercise the timeout and breaker-open paths against a `fetch` mock.

## Building + pushing the container image

CI takes over this responsibility in Story 0.6. Until then, bootstrap a new env's image manually:

```bash
# From repo root, after `az login`:
infra/scripts/build-and-push-calc.sh dev          # default tag = latest
infra/scripts/build-and-push-calc.sh staging v0.0.1
```

The script:
1. `az acr login` against `cemsacr{env}`
2. `docker build --platform=linux/amd64` (Container Apps requires amd64; M-series Macs default to arm64)
3. `docker push` to `cemsacr{env}.azurecr.io/calc-service:{tag}`

Then redeploy infra so the Container App pulls the new image:

```bash
cd infra/bicep && ./deploy.sh dev
```

## Schema source of truth — Pydantic v2

Pydantic models in `app/models/{ecm,baseline,refrigerant}.py` are the **single source of truth** for the calc-service HTTP contract.

The Node.js API duplicates these as Zod schemas in `apps/api/src/lib/calc-service-schemas.ts`. **A schema change here REQUIRES a matching update there** until Story 0.6 wires `openapi-typescript` codegen against `/openapi.json`. Look for `PARITY:` comment markers in both files.

The Node-side client validates every response with the Zod mirror — a Pydantic↔Zod drift fails as `CalcServiceError({code:'BAD_RESPONSE'})` rather than feeding bad data downstream.

## Logging

Structured JSON to stdout via `python-json-logger`. Field names mirror the Node API's Pino logger (Story 0.4) so cross-service Application Insights queries work uniformly:

```json
{
  "level": "info",
  "time": "2026-04-28T12:34:56.789Z",
  "service": "cems-calc-service",
  "env": "production",
  "request_id": "ad7c5b2e...",
  "method": "POST",
  "route": "/calculate/ecm",
  "status_code": 200,
  "duration_ms": 47.123,
  "msg": "request completed"
}
```

Sensitive keys (`password`, `secret`, `token`, `api_key`/`apiKey`) are redacted at the formatter layer.

## Error contract — RFC 7807

Every error response is `application/problem+json` with the standard fields (`type`, `title`, `status`, `detail`, `instance`, optional `errors[]`). Matches the Node API's contract from Story 0.4 so HTTP clients have a single error shape across both services.

## Public-route policy

`/health` is reachable from outside the VNet (used by Container Apps' liveness probe).

The three `/calculate/*` endpoints are reachable **only from the API service inside the same `containers-subnet`**. `external: false` in `infra/bicep/modules/containerapps.bicep` enforces this — DO NOT change without an architecture-review note in the next story's Dev Notes.

## Project structure

```
apps/calc-service/
├── app/
│   ├── main.py              # FastAPI app + middleware + error handlers
│   ├── config.py            # SERVICE_VERSION, SERVICE_NAME, ENV constants
│   ├── routes/              # ecm.py, baseline.py, refrigerant.py
│   ├── services/            # (placeholder; Story 8 lands real math)
│   ├── models/              # Pydantic v2 request/response schemas
│   └── lib/
│       ├── logger.py        # JSON logger
│       ├── middleware.py    # Per-request access logging
│       └── error_handler.py # RFC 7807 mappers
├── tests/                   # pytest suite (12 tests today)
├── Dockerfile               # amd64, healthcheck, digest-pinned base
├── .dockerignore
├── requirements.txt
├── pyproject.toml
└── package.json             # turbo proxy: dev / test / type-check / lint
```

## Dependencies

| Package | Version | Purpose |
|---|---|---|
| fastapi | 0.115.6 | HTTP framework |
| uvicorn[standard] | 0.34.0 | ASGI server |
| pydantic | 2.10.4 | Request/response validation |
| python-json-logger | 2.0.7 | Structured stdout logs |
| numpy | 2.2.1 | (Pre-installed for Story 8 math) |
| pandas | 2.2.3 | (Pre-installed for Story 8 baseline regression) |
| pytest | 8.3.4 | Test runner |
| httpx | 0.28.1 | TestClient transport |

## Deferred to later stories

- Real math — Stories 8.1 (ECM), 8.2 (baseline), 8.3 (refrigerant + LLM)
- OpenAPI-typed Zod codegen — Story 0.6 CI pipeline
- CI image build + push on PR merge — Story 0.6
- Calculation input snapshot persistence (NFR-R3) — Story 8.5
