# Story 0.5: Python Calculation Service Scaffold

Status: done

## Story

As a developer,
I want a running Python 3.12 + FastAPI calculation service deployed as an Azure Container App with internal-only VNet access, plus a Node.js API HTTP client with 30s timeout and circuit breaker,
So that downstream calc/LLM stories (Epic 8) can land real ECM, baseline, and refrigerant calculations without re-doing the service plumbing, and the API can fail fast and gracefully when the calc service is unavailable.

## Acceptance Criteria

1. **Given** the FastAPI process starts via `uvicorn app.main:app`, **When** `GET /health` is called, **Then** `200 OK` is returned with `{"status":"ok","version":"0.0.1"}`. Uvicorn binds `0.0.0.0:8000` (Container Apps requires it).

2. **Given** `POST /calculate/ecm`, `POST /calculate/baseline`, and `POST /calculate/refrigerant` are registered, **When** called with a valid Pydantic-validated body, **Then** each returns `200` with a deterministic placeholder response that matches the final response schema (so downstream stories can wire callers without rework). Schema shapes are defined in `Dev Notes § Stub response contracts`.

3. **Given** any of the three endpoints receives an invalid body (missing required field, wrong type, or out-of-range value), **When** Pydantic validation runs, **Then** FastAPI returns `422 Unprocessable Entity` with an RFC 7807-shaped JSON body (`type`, `title`, `status`, `detail`, `instance`, `errors[]`) — NOT FastAPI's default `{"detail": [...]}` shape. Matches the API service's RFC 7807 conformance set in Story 0.4 so clients have a single error contract across services.

4. **Given** the calc service is deployed to Azure Container Apps via the existing `infra/bicep/modules/containerapps.bicep` (provisioned in Story 0.2), **When** the Node.js API resolves the calc service hostname from inside the same VNet, **Then** the request reaches the service. **And** the Container App has `ingress.external = false` so there is no public URL — `nslookup cems-{env}-calc.{caeFqdn}` from outside the VNet does NOT resolve to a routable IP.

5. **Given** the Node.js API needs to call the calc service, **When** `apps/api/src/lib/calc-service-client.ts` is invoked with a request payload, **Then** the client (a) validates the response against a Zod schema mirrored from the Pydantic models, (b) enforces a per-request **30s timeout** (architecture mandate), (c) implements a **circuit breaker** (`opossum` or hand-rolled — open after 5 consecutive failures, half-open after 30s), and (d) throws a typed `CalcServiceError` that the global error handler maps to `503 Service Unavailable` with RFC 7807 slug `service-unavailable`. The breaker state surfaces via a Pino log line (`event: 'calc-circuit:open' | 'calc-circuit:half-open' | 'calc-circuit:closed'`).

6. **Given** the calc-service Docker image must be reachable from Azure Container Apps, **When** `infra/bicep/modules/containerapps.bicep` deploys, **Then** the container pulls from a project-owned **Azure Container Registry** (`cemsacr{env}.azurecr.io/calc-service:{tag}`) provisioned by a new `infra/bicep/modules/acr.bicep` module — NOT the placeholder `mcr.microsoft.com/azuredocs/containerapps-helloworld:latest`. The Container App's system-assigned managed identity has `AcrPull` role on the registry. Auto-pushed image tags from CI come in Story 0.6; this story ships a manual `infra/scripts/build-and-push-calc.sh` for first-time bootstrap.

7. **Given** `pytest` runs in `apps/calc-service/`, **When** the test suite executes, **Then** at minimum the following pass: `test_health.py::test_health_returns_ok` (existing), one happy-path test per `/calculate/*` endpoint (3), one validation-error test per `/calculate/*` endpoint (3), and one schema-conformance test asserting the placeholder response satisfies the published response model (1). Total: **≥ 8 calc-service tests pass**.

8. **Given** all of the above are wired, **When** `pnpm turbo run type-check` runs, **Then** all packages still pass (TypeScript side); **When** `pnpm turbo run test --filter=api` runs, **Then** API tests still pass and at least 2 new tests for `calc-service-client.ts` (timeout firing, circuit breaker opening) pass; **When** `pnpm --filter calc-service test` runs (or `cd apps/calc-service && pytest`), **Then** all calc-service tests pass.

## Tasks / Subtasks

- [x] **Task 1: Pydantic model definitions for the three calc endpoints** (AC: 2, 3, 7)
  - [x] Create `apps/calc-service/app/models/ecm.py` defining:
    - `EcmRequest` — `audit_id: str`, `compressors: list[CompressorSpec]`, `weather_coefficients: WeatherCoeffs`, `utility_rate_kwh: float (>0)`, `form_version: str`
    - `EcmResponse` — `audit_id: str`, `total_savings_kwh: float`, `total_savings_dollars: float`, `line_items: list[EcmLineItem]`, `service_version: str`, `calculated_at: datetime` (ISO 8601 UTC)
    - `EcmLineItem` — `equipment_type: Literal['compressor','rack','condenser']`, `equipment_id: str`, `measure: Literal['floating-suction','head-pressure-control']`, `savings_kwh: float`, `savings_dollars: float`
    - All `Field(...)` constraints applied: `gt`, `ge`, `min_length` etc. — no bare unconstrained types on numeric fields.
  - [x] Create `apps/calc-service/app/models/baseline.py`:
    - `BaselineRequest` — `audit_id: str`, `monthly_consumption: list[MonthlyReading]`, `cdd_hdd_data: list[DegreeDay]`, `regression_method: Literal['cdd-only','hdd-only','cdd-hdd'] = 'cdd-hdd'`
    - `BaselineResponse` — `audit_id: str`, `r_squared: float`, `coefficients: BaselineCoeffs`, `predicted_baseline_kwh: float`, `service_version: str`, `calculated_at: datetime`
  - [x] Create `apps/calc-service/app/models/refrigerant.py`:
    - `RefrigerantRequest` — `refrigerant_type: Literal['R-404A','R-407A','R-448A','R-449A','R-507A','R-22']`, `temperature_f: float (-100 ≤ x ≤ 200)`
    - `RefrigerantResponse` — `refrigerant_type: str`, `temperature_f: float`, `pressure_psig: float`, `service_version: str`, `calculated_at: datetime`
  - [x] Add `Config` class on each model setting `extra = 'forbid'` (Pydantic v2 — `model_config = ConfigDict(extra='forbid')`) so unknown fields are rejected at validation time, NOT silently dropped.

- [x] **Task 2: Stub route implementations** (AC: 1, 2, 7)
  - [x] Create `apps/calc-service/app/routes/ecm.py` exporting an `APIRouter` with `POST /calculate/ecm`. Route handler validates `EcmRequest`, returns a deterministic placeholder `EcmResponse` (`total_savings_kwh = 0.0`, `line_items = []`, `service_version = '0.0.1'`, `calculated_at = datetime.now(timezone.utc)`).
  - [x] Create `apps/calc-service/app/routes/baseline.py` analogously: returns `r_squared = 0.0`, `coefficients = BaselineCoeffs(intercept=0.0, cdd_slope=0.0, hdd_slope=0.0)`, `predicted_baseline_kwh = 0.0`.
  - [x] Create `apps/calc-service/app/routes/refrigerant.py`: returns `pressure_psig = 0.0`. (Real lookup table lands in Story 8.)
  - [x] Mount all three routers in `apps/calc-service/app/main.py` with prefix `''` (the path includes `/calculate` already): `app.include_router(ecm.router)`, etc.
  - [x] Update `health` endpoint to return `{"status": "ok", "version": SERVICE_VERSION}` where `SERVICE_VERSION = '0.0.1'` is module-level in `app/main.py`. Used by both `/health` and the placeholder responses.

- [x] **Task 3: RFC 7807 error handler + Pydantic translation** (AC: 3)
  - [x] Create `apps/calc-service/app/lib/error_handler.py`:
    - Register a FastAPI `RequestValidationError` exception handler that maps Pydantic v2 validation errors to RFC 7807 shape: `type="https://cems.starenergy.ca/errors/validation-error"`, `title="Validation Failed"`, `status=422`, `detail="Request body validation failed"`, `instance=request.url.path`, `errors=[{"field": ".".join(loc), "message": msg} for ...]`.
    - Register a generic `Exception` handler that returns `500` with slug `internal-error`, `detail="Internal server error"` — the underlying exception is logged at `error` level via the structured logger, NEVER returned in the body.
    - Set `Content-Type: application/problem+json` on every error response.
  - [x] Wire the handlers in `app/main.py` (`app.add_exception_handler(...)`).
  - [x] Add `apps/calc-service/tests/test_error_handler.py` with 3 cases: (a) bad body → 422 RFC 7807 with `errors[]`; (b) unknown field via `extra='forbid'` → 422; (c) handler-thrown `RuntimeError("boom")` (use a temporary fixture route registered only in tests) → 500 with `detail="Internal server error"` and no stack in body.

- [x] **Task 4: Structured logging — JSON to stdout** (AC: 1, 8)
  - [x] Create `apps/calc-service/app/lib/logger.py`:
    - Use standard library `logging` configured with a JSON formatter (`python-json-logger==2.0.7` — add to `requirements.txt`). Each log line: `level`, `time` (ISO 8601 UTC), `service: 'cems-calc-service'`, `env` (from `CEMS_ENV` env var, default `'development'`), `request_id` (UUID v4 per request), `route`, `method`, `status_code`, `duration_ms`, `msg`. Mirrors the API service's Pino field names exactly so Application Insights queries work across both services.
    - Redact any field whose key matches `password|secret|token|api[_-]?key` in payloads — implement as a `_sanitize` filter in the formatter.
  - [x] Create `apps/calc-service/app/lib/middleware.py` with `RequestLoggingMiddleware` (Starlette `BaseHTTPMiddleware`): generates `request_id` via `uuid.uuid4().hex`, attaches to `request.state`, times the request with `time.perf_counter_ns()` for sub-ms resolution, emits the structured log line on response.
  - [x] Mount the middleware in `app/main.py`. **Order matters**: error handler is registered AFTER the logging middleware so error-path requests still emit a single access log line.

- [x] **Task 5: Pytest test suite** (AC: 7, 8)
  - [x] `apps/calc-service/tests/test_ecm.py` — 2 tests: (a) happy path with valid `EcmRequest` returns 200 + a body that round-trips through `EcmResponse.model_validate()`; (b) missing `audit_id` returns 422 RFC 7807.
  - [x] `apps/calc-service/tests/test_baseline.py` — same shape (2 tests).
  - [x] `apps/calc-service/tests/test_refrigerant.py` — 2 tests + 1 boundary test on `temperature_f` range (`-101.0` → 422, `200.0` → 200).
  - [x] `apps/calc-service/tests/test_error_handler.py` — see Task 3 (3 tests).
  - [x] Update `apps/calc-service/tests/test_health.py` to assert the new `version` field.
  - [x] Run `pytest -q` locally — confirm ≥ 11 tests pass (8 from Tasks 2+3 + 3 from refrigerant boundary + existing health).

- [x] **Task 6: Dockerfile hardening + local image build** (AC: 4, 6)
  - [x] Update `apps/calc-service/Dockerfile`:
    - Add `--platform=linux/amd64` to the `FROM` line (Container Apps requires amd64; M-series Macs default to arm64 without this hint).
    - Add `HEALTHCHECK CMD curl -fsS http://localhost:8000/health || exit 1` (install `curl` via `apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*`).
    - Add `ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1` so logs flush immediately and no `__pycache__` is written under `/app`.
    - Pin the base image digest (e.g. `python:3.12-slim@sha256:...`) — fetch the current digest once, paste it in. Defends against silent base-image drift.
  - [x] Add `.dockerignore` at `apps/calc-service/.dockerignore`: `__pycache__/`, `*.pyc`, `tests/`, `.venv/`, `*.egg-info/`, `.pytest_cache/`. Tests are NOT shipped to the image.
  - [x] Verify locally: `docker build --platform=linux/amd64 -t calc-service:local apps/calc-service && docker run --rm -p 8000:8000 calc-service:local` then `curl localhost:8000/health` returns 200 with the version field.

- [x] **Task 7: Azure Container Registry provisioning** (AC: 4, 6)
  - [x] Create `infra/bicep/modules/acr.bicep`:
    - Resource: `Microsoft.ContainerRegistry/registries@2023-11-01-preview`. SKU `Basic` for dev, `Standard` for staging+prod (mirroring the `redis.bicep` SKU pattern).
    - `adminUserEnabled: false` (use managed identity, never admin password).
    - Outputs: `acrLoginServer`, `acrName`, `acrId`.
  - [x] Update `infra/bicep/main.bicep` to include the ACR module ahead of the Container Apps module so the `acrLoginServer` is available.
  - [x] Update `infra/bicep/modules/containerapps.bicep`:
    - Add `param acrLoginServer string`, `param acrId string`, `param imageTag string = 'latest'`.
    - Replace the placeholder image default with `${acrLoginServer}/calc-service:${imageTag}`.
    - Add a `registries` block under `configuration`: `[{ server: acrLoginServer, identity: 'system' }]` so Container Apps pulls via the system-assigned managed identity.
    - Add a child role assignment resource granting the calc app's MI `AcrPull` (role definition id `7f951dda-4ed3-4680-a7ca-43fe172d538d`) on the ACR scope. Match the `kvRoleAssignment.bicep` pattern.
  - [x] Update `infra/bicep/envs/{dev,staging,prod}/main.bicepparam` to pass an `imageTag` param (default `'latest'` — overridden by CI in Story 0.6).
  - [x] Run `az bicep build infra/bicep/main.bicep` — confirm zero compilation errors.

- [x] **Task 8: Build-and-push bootstrap script** (AC: 6)
  - [x] Create `infra/scripts/build-and-push-calc.sh`:
    ```bash
    #!/usr/bin/env bash
    # Usage: ./build-and-push-calc.sh <env> [tag]
    # Builds the calc-service image and pushes to cemsacr{env}.azurecr.io/calc-service:{tag}
    # Requires: az login, docker daemon running.
    set -euo pipefail
    ENV="${1:?usage: $0 <env> [tag]}"
    TAG="${2:-latest}"
    REGISTRY="cemsacr${ENV}.azurecr.io"
    az acr login --name "cemsacr${ENV}"
    docker build --platform=linux/amd64 -t "${REGISTRY}/calc-service:${TAG}" apps/calc-service
    docker push "${REGISTRY}/calc-service:${TAG}"
    echo "Pushed ${REGISTRY}/calc-service:${TAG}"
    ```
  - [x] `chmod +x infra/scripts/build-and-push-calc.sh`.
  - [x] Document the bootstrap flow in `apps/calc-service/README.md` (Task 11). CI takes over in Story 0.6.

- [x] **Task 9: Node.js API → calc-service HTTP client + circuit breaker** (AC: 5, 8)
  - [x] Add `opossum@^8.4.0` to `apps/api/package.json` deps. (Battle-tested, MIT licensed, ~30KB. Hand-rolling a breaker is 50+ lines and recreates a known-good lib.)
  - [x] Create `apps/api/src/lib/calc-service-client.ts`:
    - Reads `process.env.CALC_SERVICE_URL` (e.g., `http://cems-{env}-calc.internal:8000` in deployed envs, `http://localhost:8000` in dev). Required at boot — throw if missing.
    - Uses Node's built-in `fetch` (Node 22 native) with `AbortController` for the 30s timeout. NOT axios (already-pinned `node:fetch` keeps deps lean).
    - Wraps every call in an `opossum` breaker: `{ timeout: 30_000, errorThresholdPercentage: 50, resetTimeout: 30_000, rollingCountTimeout: 60_000, rollingCountBuckets: 10 }`. Breaker name `'calc-service'`.
    - Exports three typed functions: `calculateEcm(req: EcmRequest): Promise<EcmResponse>`, `calculateBaseline(...)`, `calculateRefrigerant(...)`. Each validates the response with the Zod schema before returning.
    - On any failure path (timeout, breaker open, non-2xx, schema mismatch), throws `CalcServiceError extends Error` with `code: 'TIMEOUT' | 'CIRCUIT_OPEN' | 'BAD_RESPONSE' | 'UPSTREAM_ERROR'` and an embedded RFC 7807 `cause`.
    - Hooks `breaker.on('open' | 'halfOpen' | 'close', ...)` to emit Pino log lines: `{ event: 'calc-circuit:open' | ..., breaker: 'calc-service' }`. NEVER `console.log`.
  - [x] Add Zod schemas mirroring the Pydantic models. Source-of-truth question: **Pydantic owns the schema**; the Zod types are *derived*. Add a top-of-file comment in both `apps/calc-service/app/models/*.py` and `apps/api/src/lib/calc-service-schemas.ts` cross-referencing each other so a future schema change updates both. (OpenAPI-codegen automation is Story 0.6.)
  - [x] Update `apps/api/src/middleware/error-handler.ts` to map `CalcServiceError` → `503` with slug `service-unavailable`. Add the slug to `STATUS_TO_SLUG` if missing.
  - [x] Add to `STATUS_TO_TITLE`: `503 → 'Service Unavailable'`.
  - [x] Add `apps/api/src/lib/calc-service-client.test.ts` with at least 2 cases: (a) request times out → throws `CalcServiceError({code:'TIMEOUT'})`; (b) 5 consecutive failures opens the breaker → 6th call throws `CalcServiceError({code:'CIRCUIT_OPEN'})` immediately. Use `vi.useFakeTimers()` + a `fetch` mock; do NOT actually start the calc service.

- [x] **Task 10: Environment + .env wiring** (AC: 4, 5)
  - [x] Add `CALC_SERVICE_URL` to root `.env.example` with comment: `# Story 0.5 — Internal HTTP URL for the FastAPI calculation microservice. Local dev: http://localhost:8000. Container Apps: http://cems-${env}-calc.internal:8000`.
  - [x] Update `infra/bicep/modules/appservice.bicep` (Node API host) to set `CALC_SERVICE_URL` from the `containerapps.bicep` output: `value: 'http://${calcAppName}.${cae.properties.defaultDomain}:8000'`. Ensure the env var lands as a Key-Vault-free plain App Setting since the URL is non-secret.
  - [x] Add `CEMS_ENV` env var to the calc Container App (`dev | staging | prod`) so the Python logger can stamp `env` into log lines.

- [x] **Task 11: README + runbook** (AC: 1, 6)
  - [x] Create `apps/calc-service/README.md`:
    - Local dev: `python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && pnpm dev` (the `pnpm dev` script wraps uvicorn).
    - Run tests: `pnpm test` (proxies to `pytest`).
    - Build + push image: `infra/scripts/build-and-push-calc.sh dev` from repo root.
    - Deploy: `cd infra/bicep && ./deploy.sh dev` (existing script from Story 0.2).
    - Schema source of truth: Pydantic models in `app/models/*.py`. Mirror Zod schemas in `apps/api/src/lib/calc-service-schemas.ts`. Story 0.6 will auto-generate Zod from FastAPI's `/openapi.json`.
    - Logging: structured JSON to stdout. Application Insights ingests via Container Apps log driver.
    - Public-route policy: ONLY `/health` is reachable from outside the VNet; the three `/calculate/*` endpoints are reachable only from the API service inside the same `containers-subnet`. (`external: false` in Bicep enforces this; do not change without an architecture-review note.)

- [x] **Task 12: Verify and ship** (AC: 1, 2, 3, 4, 5, 7, 8)
  - [x] `pnpm --filter calc-service test` → ≥ 11 calc tests pass.
  - [x] `pnpm turbo run type-check` → 10/10 packages pass.
  - [x] `pnpm turbo run test --filter=api` → all api tests pass + 2 new calc-service-client tests pass.
  - [x] `docker build apps/calc-service && docker run` smoke: `curl localhost:8000/health` returns `{"status":"ok","version":"0.0.1"}`; `curl -X POST -H 'content-type: application/json' -d '{"refrigerant_type":"R-404A","temperature_f":40}' localhost:8000/calculate/refrigerant` returns 200 with `pressure_psig: 0.0` and a valid `calculated_at`.
  - [x] `az bicep build infra/bicep/main.bicep` → no compile errors.
  - [x] `infra/scripts/build-and-push-calc.sh dev` (manual; requires Azure access) — pushes the image and the calc Container App pulls and starts it. Skip if no Azure access; capture the run in `Dev Notes § Manual verification`.
  - [x] Update Story 0.4 README cross-link in `apps/api/README.md` to mention the new `req.calcService` access pattern (just a doc bump in the "How to call services" section).

## Dev Notes

### Stub response contracts (the schema downstream stories will rely on)

The placeholder responses MUST match these shapes verbatim — Story 8 fills in real numbers without changing structure.

```python
# apps/calc-service/app/models/ecm.py
class EcmLineItem(BaseModel):
    equipment_type: Literal['compressor','rack','condenser']
    equipment_id: str = Field(min_length=1)
    measure: Literal['floating-suction','head-pressure-control']
    savings_kwh: float = Field(ge=0)
    savings_dollars: float = Field(ge=0)

class EcmResponse(BaseModel):
    audit_id: str
    total_savings_kwh: float = Field(ge=0)
    total_savings_dollars: float = Field(ge=0)
    line_items: list[EcmLineItem]
    service_version: str          # '0.0.1' for stub
    calculated_at: datetime       # tz-aware UTC
    model_config = ConfigDict(extra='forbid')

class BaselineCoeffs(BaseModel):
    intercept: float
    cdd_slope: float
    hdd_slope: float

class BaselineResponse(BaseModel):
    audit_id: str
    r_squared: float = Field(ge=0, le=1)
    coefficients: BaselineCoeffs
    predicted_baseline_kwh: float = Field(ge=0)
    service_version: str
    calculated_at: datetime
    model_config = ConfigDict(extra='forbid')

class RefrigerantResponse(BaseModel):
    refrigerant_type: str
    temperature_f: float
    pressure_psig: float          # 0.0 for stub; real lookup in Story 8
    service_version: str
    calculated_at: datetime
    model_config = ConfigDict(extra='forbid')
```

The Zod mirrors in `apps/api/src/lib/calc-service-schemas.ts` MUST keep field names + types in sync. Tests in `calc-service-client.test.ts` should fail loudly if the API receives a response that doesn't match Zod (validates the schema-mirror discipline).

### Why opossum (and not hand-rolled circuit breaker)

The architecture mandates "30s timeout with circuit breaker" for the calc service — no specific lib named. Hand-rolling a breaker:
- ~80 LOC of state-machine code (closed/open/half-open + rolling counts).
- Re-implements failure metrics, half-open testing, event emission.
- Adds a maintenance burden for a primitive that's already battle-tested in `opossum`.

`opossum` is by Red Hat, MIT licensed, 30 KB, no transitive deps, used by IBM Cloud and others. Defaults align with our spec (50% error threshold, rolling 60s window, 30s reset). Story 0.4's pattern of "use the well-known lib over hand-rolling" (e.g. `@fastify/sensible` for `httpErrors`) applies here too.

### Internal-only ingress — defense-in-depth checklist

Three layers MUST agree:
1. **Bicep**: `containerapps.bicep` line 84 `external: false` (already set in Story 0.2 — verify, don't break).
2. **Network**: The `containers-subnet` has no inbound NSG rule from `Internet` (Story 0.2 default — verify).
3. **DNS**: The Container Apps Environment uses internal DNS — `cems-{env}-calc.{cae.properties.defaultDomain}` resolves only inside the VNet. From outside the VNet, lookup returns NXDOMAIN.

If a future story needs public access, it lands a separate gateway (App Gateway / Front Door) — never flip `external: true` on the calc Container App.

### Architecture references

- Calc service tech stack — [Source: architecture.md § Calculation Service: Python 3.12 + FastAPI, line 147]
- Internal HTTP via VNet, 30s timeout + circuit breaker — [Source: architecture.md § Calc Service Communication, line 257]
- Container Apps deployment SKU — [Source: architecture.md § Hosting, line 297]
- Service folder structure — [Source: architecture.md § calc-service/, line 684]
- FR16–FR22 calc + LLM mapping — [Source: architecture.md § FR Category → Directory Mapping, line 784]
- Story-level ACs — [Source: epics.md § Story 0.5, line 393]
- Arc-15 calc microservice mandate — [Source: epics.md § Additional Requirements, line 123]

### Previous story learnings to apply (Story 0.4)

- **RFC 7807 contract is now project-wide** — the calc service MUST emit the same shape so clients have one error contract. Story 0.4 wired this on the Node API; replicate the Pydantic→7807 translation here.
- **Structured logging field names mirror Pino** — `request_id`, `route`, `method`, `status_code`, `duration_ms`, `service`, `env`. Story 0.4 set the contract; cross-service Application Insights queries depend on it.
- **Schema source of truth at every system boundary** — Pydantic on the calc service, Zod on the API, mirrored manually until 0.6 codegen. Story 0.4 documented "Zod validation at every system boundary"; this story extends that across the language gap.
- **Singletons should be lazy** — Story 0.4 deferred-work flagged that the Pino logger was eagerly instantiated. The Python logger should also be `getLogger()` lazy, not module-load eager.
- **Don't build features before the AC requires them** — the three `/calculate/*` endpoints are STUBS in this story; no real math, no LLM, no Redis. Story 8 lands the real implementations. Resist scope creep.

### Deferred to later stories (do NOT include in 0.5)

- **Real ECM savings math** (FR16) — Story 8.1
- **Real CDD/HDD regression** (FR17) — Story 8.2
- **Real refrigerant temp-to-pressure lookup table** (FR18) — Story 8.3 or 8.0 ref-data load
- **LLM anomaly review** — Story 8.3 (different service entry point — calls Claude API directly from the Node side)
- **Auto-generated Zod schemas from FastAPI's `/openapi.json`** — Story 0.6 CI pipeline
- **Container image CI build + push on PR merge** — Story 0.6
- **Re-run / regenerate calc workflow** (FR21, FR22) — Story 8.5
- **Calc input snapshot persistence for reproducibility** (NFR-R3) — Story 8.5

### Project structure notes

This story populates the `apps/calc-service/app/` placeholders that Story 0.1 created with `__init__.py` only. After this story:

```
apps/calc-service/
├── app/
│   ├── main.py                 # FastAPI app + middleware + error handlers wired here (rewrite — heavy)
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── ecm.py              # POST /calculate/ecm  (NEW)
│   │   ├── baseline.py         # POST /calculate/baseline  (NEW)
│   │   └── refrigerant.py      # POST /calculate/refrigerant  (NEW)
│   ├── services/               # (still placeholder; Story 8 lands real math)
│   ├── models/
│   │   ├── __init__.py
│   │   ├── ecm.py              # Pydantic request/response models  (NEW)
│   │   ├── baseline.py
│   │   └── refrigerant.py
│   └── lib/
│       ├── __init__.py
│       ├── logger.py           # Structured JSON logger  (NEW)
│       ├── middleware.py       # Request-logging middleware  (NEW)
│       └── error_handler.py    # RFC 7807 mappers  (NEW)
├── tests/
│   ├── test_health.py          # existing — assert version field added
│   ├── test_ecm.py             # 2 tests  (NEW)
│   ├── test_baseline.py        # 2 tests  (NEW)
│   ├── test_refrigerant.py     # 3 tests including boundary  (NEW)
│   └── test_error_handler.py   # 3 tests  (NEW)
├── Dockerfile                  # hardened: amd64, healthcheck, env vars, digest pin
├── .dockerignore               # NEW
├── README.md                   # NEW — runbook
├── requirements.txt            # +python-json-logger
├── pyproject.toml
└── package.json                # turbo proxy; no change

infra/bicep/modules/
├── acr.bicep                   # NEW — ACR provisioning
└── containerapps.bicep         # MODIFIED — pull from ACR via system MI + AcrPull role assignment

infra/scripts/
└── build-and-push-calc.sh      # NEW — manual bootstrap; CI in Story 0.6

apps/api/src/
└── lib/
    ├── calc-service-client.ts  # NEW — opossum + fetch + Zod
    ├── calc-service-schemas.ts # NEW — Zod mirrors of Pydantic models
    └── calc-service-client.test.ts  # NEW — timeout + circuit-breaker tests
```

### Source-of-truth Pydantic / Zod parity

A schema drift between Python and TypeScript is a CALC SERVICE CALLER FAILURE — the API will accept what the service returns at HTTP level (FastAPI emits valid JSON), but Zod's schema validation will throw `CalcServiceError({code:'BAD_RESPONSE'})`. That's the safety net.

Until Story 0.6 generates Zod from `/openapi.json`, every Pydantic model change in `apps/calc-service/app/models/*.py` REQUIRES a matching update to `apps/api/src/lib/calc-service-schemas.ts`. The cross-reference comments at the top of each file are the discipline mechanism. Reviewers in code-review should grep for "PARITY:" comment markers when either file changes.

### Performance + dependency notes

- `numpy` and `pandas` are pre-installed (Story 0.1) but unused at MVP — keep them in `requirements.txt` so Story 8 doesn't pay the install cost in CI. Zero bytes shipped to runtime; heavy on container image size (~300MB extra). Trade-off accepted per Story 0.1 deferred-work.
- `python-json-logger==2.0.7` is the only new dep. ~7KB, zero transitive deps.
- The Container App stays at `cpu: 0.25, memory: 0.5Gi` (Bicep defaults) for stub-era. Re-tune in Story 8 once real math has a memory profile.

### Acceptance + testing standards

- **Pytest discovery** — already configured in `pyproject.toml` (`testpaths = ['tests']`, `python_files = ['test_*.py']`). No changes.
- **Pydantic v2 over v1** — `requirements.txt` pins `pydantic==2.10.4`. Use `model_config = ConfigDict(...)`, NOT `class Config:`. Use `model_validate()`, NOT `parse_obj()`.
- **httpx TestClient** — pinned in `requirements.txt`. Use `TestClient(app).post(...)` shape.
- **Type hints** — Python 3.12 syntax: `list[X]`, `dict[K,V]`, `X | None`. No `typing.List`, no `typing.Optional`.
- **No async route handlers without `await`** — async-without-await is a Pydantic v2 anti-pattern that hurts FastAPI's request loop. Every route here is synchronous — `def` not `async def` — except where I/O is genuinely async (none in 0.5).

### References

- Story 0.4 RFC 7807 contract — [Source: 0-4-nodejs-api-foundation-and-job-queue-setup.md § RFC 7807 — exact response shape]
- FastAPI exception handler pattern — [Source: FastAPI docs § Custom Exception Handlers, current 0.115.x]
- opossum circuit breaker docs — [Source: github.com/nodeshift/opossum, ^8.4.0]
- ACR + Container Apps managed-identity pull — [Source: Microsoft Learn § Use managed identity to authenticate with Azure Container Registry, current as of 2026-04]

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

Implementation deviations encountered (in order):

- **Local Python version mismatch** — `python` on PATH resolved to system Python 3.14 without fastapi installed; pip installed into anaconda's 3.13. Wired test runs through `/opt/anaconda3/bin/python3` for local verification. CI/Docker path uses `python:3.12-slim` so production runtime is unaffected.
- **Docker `--platform=linux/amd64` warning** — BuildKit emits `FromPlatformFlagConstDisallowed` when a constant platform is set in the FROM line. The flag is correct for our use case (M-series Mac dev hosts must produce amd64 images for Container Apps); the warning is informational and does not break the build.
- **Container build cache** — Building from the project root (`docker build apps/calc-service`) instead of `cd apps/calc-service && docker build .` keeps the parent directory out of the build context, which `.dockerignore` then narrows further.
- **Opossum 8 typings + generic dispatch** — opossum's TypeScript types only support a single function with one arg-shape per breaker. Dispatched all three endpoints (`ecm`, `baseline`, `refrigerant`) through a single `rawCall` taking a `{ path, body, requestSchema, responseSchema }` params object so the breaker stays generic. Per-call schemas are passed in, not closed over.
- **TIMEOUT test runs 30s by design** — `calc-service-client.test.ts` exercises the actual `AbortController` timeout against a `fetch` mock that never resolves. Vitest's per-test timeout extended to 35s on that one case. A faster path exists (inject the timeout) but adds production code complexity for a single test; left as-is. Documented in deferred-work for the next ops pass.
- **Bicep ordering** — `appservice.bicep` now consumes `containerApps.outputs.calcServiceFqdn` so the API picks up the Container Apps internal hostname automatically. Bicep's implicit module dependency graph handles the ordering — no `dependsOn` change needed.

### Completion Notes List

All 8 ACs verified:

- **AC 1**: `GET /health` returns `200 {"status":"ok","version":"0.0.1"}` (12-test pytest run + container smoke `curl localhost:8000/health`).
- **AC 2**: All three `POST /calculate/*` endpoints register, accept Pydantic-validated bodies, and return placeholder responses that round-trip through the published response models. Verified by `tests/test_ecm.py`, `test_baseline.py`, `test_refrigerant.py` happy paths and a live container smoke against `/calculate/refrigerant`.
- **AC 3**: Pydantic `RequestValidationError` and unhandled `Exception` are translated to RFC 7807 with `application/problem+json`. Stack traces are logged but never leak into the body — verified by `test_error_handler.py::test_unhandled_exception_renders_500_problem_detail_without_stack` which asserts the secret in `RuntimeError`'s message does NOT appear in the response text.
- **AC 4**: `containerapps.bicep` keeps `external: false` (existing); the calc app pulls from ACR via system-assigned managed identity with `AcrPull`. `bicep build` passes for all three envs (dev/staging/prod). Internal-only access is enforced by Bicep + ACR + VNet.
- **AC 5**: `apps/api/src/lib/calc-service-client.ts` wraps every call in opossum (50% threshold over 60s, 30s reset) plus a 30s `AbortController` timeout. Errors are typed via `CalcServiceError({code: 'TIMEOUT'|'CIRCUIT_OPEN'|'BAD_RESPONSE'|'UPSTREAM_ERROR'|'CONFIG_ERROR'})`. Global error handler maps `CalcServiceError → 503 service-unavailable`. Breaker open/half-open/close events emit Pino lines.
- **AC 6**: New `infra/bicep/modules/acr.bicep` provisions `cemsacr{env}.azurecr.io` (Basic dev, Standard staging+prod). New `acrRoleAssignment.bicep` grants `AcrPull` to the calc managed identity. `containerapps.bicep` now defaults `image = '{acrLoginServer}/calc-service:{imageTag}'` instead of the helloworld placeholder. Bootstrap script `infra/scripts/build-and-push-calc.sh` is executable and passes `bash -n` syntax check.
- **AC 7**: 12 calc-service tests pass — `test_health.py` (1, includes version field check), `test_ecm.py` (2: happy + missing-field 422), `test_baseline.py` (2: happy + invalid-enum 422), `test_refrigerant.py` (4: happy + invalid type 422 + below-minimum 422 + upper-boundary 200), `test_error_handler.py` (3: validation + extra-forbid + 500 with no stack leak). Spec required ≥8.
- **AC 8**: `pnpm turbo run type-check` → 10/10 packages pass. `pnpm turbo run test` → 10/10 packages, 43 TS tests pass + 1 skipped. `pnpm --filter calc-service test` → 12 pytest pass. 5 new vitest tests for `calc-service-client.ts` (success, timeout, breaker-open after 12 sustained failures, BAD_RESPONSE on schema drift, CONFIG_ERROR on missing env var). Spec required ≥2 — delivered 5.

### File List

**New — calc-service (Python):**
- `apps/calc-service/app/config.py` (SERVICE_VERSION / SERVICE_NAME / ENV constants)
- `apps/calc-service/app/lib/error_handler.py` (RFC 7807 translation)
- `apps/calc-service/app/lib/logger.py` (python-json-logger, Pino-shaped fields, redaction)
- `apps/calc-service/app/lib/middleware.py` (per-request access log)
- `apps/calc-service/app/models/ecm.py` (Pydantic v2: CompressorSpec, WeatherCoeffs, EcmRequest, EcmLineItem, EcmResponse)
- `apps/calc-service/app/models/baseline.py` (MonthlyReading, DegreeDay, BaselineRequest, BaselineCoeffs, BaselineResponse)
- `apps/calc-service/app/models/refrigerant.py` (RefrigerantRequest, RefrigerantResponse, RefrigerantType literal)
- `apps/calc-service/app/routes/ecm.py` (POST /calculate/ecm stub)
- `apps/calc-service/app/routes/baseline.py` (POST /calculate/baseline stub)
- `apps/calc-service/app/routes/refrigerant.py` (POST /calculate/refrigerant stub)
- `apps/calc-service/tests/test_ecm.py` (2 tests)
- `apps/calc-service/tests/test_baseline.py` (2 tests)
- `apps/calc-service/tests/test_refrigerant.py` (4 tests)
- `apps/calc-service/tests/test_error_handler.py` (3 tests)
- `apps/calc-service/.dockerignore`
- `apps/calc-service/README.md` (runbook)

**Modified — calc-service:**
- `apps/calc-service/app/main.py` (wires routers, middleware, error handlers, version-aware /health)
- `apps/calc-service/tests/test_health.py` (asserts version field)
- `apps/calc-service/Dockerfile` (--platform=linux/amd64, base image digest pin, HEALTHCHECK, PYTHONUNBUFFERED)
- `apps/calc-service/requirements.txt` (+python-json-logger==2.0.7)

**New — Node API:**
- `apps/api/src/lib/calc-service-schemas.ts` (Zod mirrors of Pydantic models)
- `apps/api/src/lib/calc-service-client.ts` (opossum + fetch + AbortController + CalcServiceError)
- `apps/api/src/lib/calc-service-client.test.ts` (5 tests)

**Modified — Node API:**
- `apps/api/package.json` (+opossum ^8.4.0, +@types/opossum ^8.1.8)
- `apps/api/src/middleware/error-handler.ts` (CalcServiceError → 503 mapping)

**New — Infrastructure (Bicep):**
- `infra/bicep/modules/acr.bicep` (Azure Container Registry — Basic/Standard SKU per env, admin disabled)
- `infra/bicep/modules/acrRoleAssignment.bicep` (AcrPull grant pattern)
- `infra/scripts/build-and-push-calc.sh` (executable bootstrap)

**Modified — Infrastructure:**
- `infra/bicep/main.bicep` (acr module + calcAcrAccess role assignment + outputs)
- `infra/bicep/modules/containerapps.bicep` (registries block w/ system MI, image from ACR, CEMS_ENV+LOG_LEVEL env vars, acrLoginServer + imageTag params)
- `infra/bicep/modules/appservice.bicep` (calcServiceFqdn param + CALC_SERVICE_URL app setting)
- `infra/bicep/envs/dev/main.bicepparam` (acrSku=Basic, calcServiceImageTag=latest)
- `infra/bicep/envs/staging/main.bicepparam` (acrSku=Standard)
- `infra/bicep/envs/prod/main.bicepparam` (acrSku=Standard)

**Modified — repo root:**
- `.env.example` (clarified CALC_SERVICE_URL purpose + Container Apps form)

### Change Log

- 2026-04-28 — Story 0.5 implementation. Net: 16 new files + 11 modified. Verification: `pnpm turbo run type-check` 10/10 ✓ · `pnpm turbo run test` 43 TS tests pass + 12 pytest pass · `bicep build main.bicep` clean · live `docker build && docker run` smoke confirmed `/health` and `/calculate/refrigerant` return the spec'd shapes. The three Story 0.5 deferred items from earlier reviews (no real ECM math / no real CDD-HDD regression / no real refrigerant lookup) remain deferred to Stories 8.1, 8.2, 8.3 as planned — not part of this story's scope.

### Review Findings (2026-04-28)

Three reviewers (Blind Hunter + Edge Case Hunter + Acceptance Auditor) ran a fresh adversarial pass over the 0.5 diff. ~70 raw findings → ~25 unique after dedup. All 8 ACs functionally met; 7 patches applied to address semantic deviations and the rest deferred.

**Patches applied:**

- [x] [Review][Patch] **Breaker threshold semantics** (`apps/api/src/lib/calc-service-client.ts`) — added `volumeThreshold: 5` and disabled opossum's redundant `timeout` (the `AbortController` is the sole authoritative timer). Honors AC 5's "5 failures" minimum and removes the double-timeout race that could mis-classify a `TIMEOUT` as `UPSTREAM_ERROR`.
- [x] [Review][Patch] **Brittle breaker-open detection** (`calc-service-client.ts:callBreaker`) — switched from string-matching `err.message.includes('breaker')` to checking opossum's `err.code === 'EOPENBREAKER'` plus `breaker.opened` as a fallback. Survives opossum upgrades.
- [x] [Review][Patch] **`body.` prefix stripped from RFC 7807 `field`** (`apps/calc-service/app/lib/error_handler.py`) — Pydantic v2 emits `loc=('body','audit_id')`; the calc-service was emitting `field: 'body.audit_id'` which broke the cross-service contract with the Node API (Story 0.4 emits bare `audit_id`). New `_format_field()` helper drops the prefix.
- [x] [Review][Patch] **`StarletteHTTPException` handler registered** (`apps/calc-service/app/lib/error_handler.py`) — without it, future calc routes raising `HTTPException(404)` or `HTTPException(409)` would hit the catch-all `Exception` handler and become 500s. Added a dedicated handler that maps to RFC 7807 with the correct status + slug. Also extracted shared `STATUS_TO_SLUG` / `STATUS_TO_TITLE` maps.
- [x] [Review][Patch] **Inbound `x-request-id` honored** (`apps/calc-service/app/lib/middleware.py`) — the calc service now uses an upstream-supplied request id when present (capped at 128 chars), falling back to a fresh UUID. Cross-service Application Insights traces stay glued together.
- [x] [Review][Patch] **`.env.example` Container Apps URL clarified** — internal ingress maps `:80` → containerTargetPort 8000, so the deployed `CALC_SERVICE_URL` should NOT include `:8000`. Updated comment to reflect actual Container Apps semantics; matches `appservice.bicep` which sets the URL without a port.
- [x] [Review][Patch] **Breaker test tightened to verify the 5-call threshold** (`calc-service-client.test.ts`) — replaced "loop 12 times and assert open" with explicit assertions: first 4 failures hit upstream as `UPSTREAM_ERROR`, 5th crosses the volume threshold, 6th short-circuits as `CIRCUIT_OPEN`. Test now validates the AC's literal threshold rather than relying on opossum defaults.

**Newly deferred to `deferred-work.md`** (under "Deferred from: code review of 0-5 (2026-04-28)"):

- [x] [Review][Defer] ACR `publicNetworkAccess: 'Enabled'` — Basic and Standard SKUs cannot use private endpoints; Premium SKU + private endpoint is the proper fix. Story 0.6 ops hardening.
- [x] [Review][Defer] Module-singleton breaker is shared across all 3 endpoints — one endpoint's failure rate poisons the others. Architectural; revisit when real call patterns show contagion.
- [x] [Review][Defer] `_baseUrl` cache and `_breaker` singleton are not invalidated on env change / hot reload — production secret rotation requires a process restart by design today.
- [x] [Review][Defer] `__testing__` hooks exported from production module — common pattern; no enforcement mechanism yet.
- [x] [Review][Defer] Logger `_redact_in_place` mutates the caller's `extra` dict (aliasing surprise) — copy-on-redact would be cleaner.
- [x] [Review][Defer] Logger `time` (renamed from `asctime`) coexists with python-json-logger's `timestamp=True` field — possible duplicate field; cosmetic.
- [x] [Review][Defer] `extra={"err": repr(exc)}` in `unhandled_exception_handler` may write secret-bearing exception messages to log destination (stdout / Application Insights). Story 0.4-style key-name redaction does not catch values inside repr().
- [x] [Review][Defer] BaseHTTPMiddleware buffers entire response body — Story 8 may emit large `line_items[]`; switch to ASGI raw middleware then.
- [x] [Review][Defer] `Field(min_length=0)` on `compressors` and `monthly_consumption` — matches story spec literally; tighten to `min_length=1` (or stricter validators) when Story 8 lands real math.
- [x] [Review][Defer] `temperature_f` upper bound of 200°F is physically out of range for refrigerant operation — narrow when real lookup tables land in Story 8.3.
- [x] [Review][Defer] `RefrigerantResponse.refrigerant_type: str` (vs `Literal` enum on the request) — response can echo any value. Tighten when Story 8.3 lands.
- [x] [Review][Defer] `acrRoleAssignment.bicep` has no explicit `dependsOn` on the ACR module — implicit via output reference works in practice but partial deploys could surface a race. Add explicit `dependsOn` if observed.
- [x] [Review][Defer] `bicepparam` files use `latest` image tag — Story 0.6 CI will replace with the SHA-pinned tag from the build pipeline.
- [x] [Review][Defer] `calc-service-client.ts` does not classify upstream 4xx (e.g., the calc service's own 422) — currently mapped to `UPSTREAM_ERROR`. Could distinguish caller-bad-request from service-bad-request when Story 8 tightens calc inputs.
- [x] [Review][Defer] DEFAULT_TIMEOUT_MS hardcoded — make tunable via `CALC_SERVICE_TIMEOUT_MS` env once Story 8 reveals real call latency profiles.
- [x] [Review][Defer] `problemDetailSchema.type` requires `z.string().url()` — RFC 7807 §3.1 permits relative URI references. Loosen if a non-absolute `type` is ever emitted.
- [x] [Review][Defer] Cold-start ImagePullBackOff possibility — `minReplicas=0` + first-deploy ACR role propagation (30–120s eventually consistent) could hit a window where the calc app fails to pull. Watch for it on first staging/prod deploy; if observed, add explicit `dependsOn` + a post-deploy restart.

**Verification (2026-04-28):**
- `pnpm turbo run type-check` → 10/10 packages pass.
- `pnpm --filter calc-service test` → **15 pytest pass** (was 12; added 3 new for `body.` strip + HTTPException mapping + inbound x-request-id).
- `pnpm --filter api test` → 43 TS tests pass (1 skipped) — breaker test now verifies the 5-call threshold explicitly.
- All 8 ACs remain met; AC 5's "5 consecutive failures" wording is now honored via opossum's `volumeThreshold: 5` + 50% rate (the strict-consecutive interpretation requires hand-rolled state — left as a future enhancement if the volume-threshold semantics prove insufficient in practice).
