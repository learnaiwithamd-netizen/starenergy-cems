# CEMS — Star Energy Carbon/Energy Management System

Turborepo monorepo: 3 React SPAs + 1 Fastify API + 1 Python calc microservice + shared packages.

## Workspace layout

```
apps/
├── audit-app/        Mobile-first auditor PWA
├── admin-app/        Admin console
├── client-portal/    Read-only client dashboard
├── api/              Node 22 + Fastify 5 REST API
└── calc-service/     Python 3.12 + FastAPI calc microservice
packages/
├── ui/               shadcn/ui-based component library
├── types/            Shared TS types + Zod schemas
├── db/               Prisma schema + RLS middleware
└── config/           ESLint, TypeScript, Tailwind presets
infra/                Bicep + GitHub Actions runbook
```

## Local development

```bash
pnpm install
pnpm dev              # parallel watch: vite x3 + tsx + uvicorn
```

Service-specific READMEs:
- [`apps/api/README.md`](./apps/api/README.md)
- [`apps/calc-service/README.md`](./apps/calc-service/README.md)
- [`infra/README.md`](./infra/README.md)

## CI/CD

GitHub Actions wires four workflows:

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci.yml` | PR to `main` | `turbo run lint type-check test build`, SWA preview deploys, calc-service Pydantic↔Zod parity check, `actionlint` self-check |
| `deploy-staging.yml` | Push to `main` | Build calc image (SHA-tagged), Prisma migrate, deploy SPAs, App Service slot-swap with auto-rollback on failed health check |
| `deploy-prod.yml` | Manual (`workflow_dispatch`) | Verify SHA succeeded on staging, halt at `production` environment gate, deploy mirroring staging steps, tag release |
| Dependabot | Weekly | npm / pip / actions / docker version bumps |

Auth uses **Azure OIDC federated credentials** — no long-lived service-principal secrets. See [`infra/README.md`](./infra/README.md) for the bootstrap order.

### Turborepo Remote Cache

CI uses [`dtinth/setup-github-actions-caching-for-turbo`](https://github.com/dtinth/setup-github-actions-caching-for-turbo) so cache hits are free and stay inside the repo's permissions. Developers can opt into the same cache locally:

```bash
gh auth login                                     # one-time
gh extension install actions/gh-actions-cache    # optional, for inspection
# then run any `pnpm turbo run …` and watch for `cache hit, replaying logs`
```

### Custom ESLint rules

`@cems/config/eslint` exports a `cems/no-tenant-raw-prisma` rule that flags
direct `prisma.$queryRaw` / `$executeRaw` use outside the `db-health` route.
See [`packages/config/eslint/rules/no-tenant-raw-prisma.js`](./packages/config/eslint/rules/no-tenant-raw-prisma.js).

## Security posture

- All secrets via Azure Key Vault (runtime) or OIDC federated identity (deploy).
- RLS enforced via `withRlsTransaction` (Story 0.4); raw-query bypass blocked by lint rule (Story 0.6).
- API uses RFC 7807 problem-detail responses; calc-service emits the same shape so clients see one contract across services.
- All endpoints require auth except: `/api/v1/health`, `/api/v1/db-health`, `/api/v1/docs`, `/api/v1/auth/login|refresh`. Anything else added requires architecture review.
