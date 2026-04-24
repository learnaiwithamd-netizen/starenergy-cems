# @cems/db

Prisma schema + Row-Level Security middleware for Star Energy CEMS.

## Local development setup

```bash
# From repo root:
docker compose up -d sql
./packages/db/scripts/init-dev-db.sh

# Then write .env in packages/db/ (see .env.example at repo root for shape):
echo 'DATABASE_URL="sqlserver://localhost:1433;database=cems_dev;user=SA;password=Your_strong_pw_123;trustServerCertificate=true;encrypt=true"' > packages/db/.env

# Apply migrations:
pnpm --filter @cems/db db:migrate:dev

# Explore:
pnpm --filter @cems/db db:studio
```

The database created by docker-compose is a development-only SQL Server 2022 instance. Never use this password or setup in staging/prod — those environments get their `DATABASE_URL` injected from Key Vault via App Service app settings (see `infra/bicep`).

## Migrations

Migration files under `prisma/migrations/` are the source of truth for schema evolution. Two migrations ship with Story 0.3:

1. **`<timestamp>_init`** — all 16 tables with snake_case conventions, indexes, FK constraints (with `NoAction` referential action due to SQL Server limitations; Prisma's `Restrict` is not supported by the connector)
2. **`<timestamp>_add_rls_and_checks`** — CHECK constraints on `users.role` and `audits.status` (enforce the enum values since SQL Server connector doesn't support Prisma enums), plus 14 RLS security policies across all tenant-scoped tables

### Enum values (CHECK-enforced at DB layer)

- `users.role`: `'ADMIN'` | `'AUDITOR'` | `'CLIENT'`
- `audits.status`: `'DRAFT'` | `'SUBMITTED'` | `'IN_REVIEW'` | `'CALC_IN_PROGRESS'` | `'CALC_COMPLETE'` | `'MANUAL_REVIEW_REQUIRED'` | `'APPROVED'` | `'PUBLISHED'`

Compile-time safety in app code comes from `@cems/types` (`UserRole`, `AuditStatus`).

## Row-Level Security

RLS is enforced via `SESSION_CONTEXT` on every SQL Server connection. The `withRlsContext(prisma, context)` helper extends a PrismaClient so that every query automatically runs:

```sql
EXEC sp_set_session_context @key = N'tenant_id', @value = <tenantId>;
EXEC sp_set_session_context @key = N'user_id', @value = <userId>;
EXEC sp_set_session_context @key = N'user_role', @value = <role>;
EXEC sp_set_session_context @key = N'assigned_store_ids', @value = <json array>;
```

Security policies (in the `security` schema) then filter rows based on these context values:

- **Every tenant-scoped table**: `security.fn_tenant_predicate(tenant_id)` — matches current tenant OR caller is ADMIN
- **Audits table (additional filter)**: `security.fn_audits_filter(tenant_id, store_id)` — AND (role != CLIENT OR store_id is in assigned_store_ids JSON)
- **Reference data `compressor_refs`**: NOT RLS-protected — global data

### Verified behaviour (via sqlcmd against local docker SQL Server, 2026-04-24)

| Session context | Visible audits |
|---|---|
| `user_role = ADMIN` | All tenants |
| `tenant_id = 'tA'`, `user_role = AUDITOR` | Only `tenant_id = 'tA'` rows |
| `tenant_id = 'tB'`, `user_role = AUDITOR` | Only `tenant_id = 'tB'` rows |
| `user_role = CLIENT`, `assigned_store_ids = ['stA']` | Only rows where `store_id = 'stA'` |
| `user_role = CLIENT`, `assigned_store_ids = []` | Zero rows |

To replicate: `docker exec cems-sql /opt/mssql-tools18/bin/sqlcmd -S localhost -d cems_dev -U SA -P "<pw>" -C -Q "<script>"`.

## Bypassing the middleware

**Don't.** Architecture mandate: every query goes through `withRlsContext(prisma, ctx)`. Using raw `prisma.$queryRaw` without `SESSION_CONTEXT` set is a tenant-isolation escape. If you must execute raw SQL, do it via `withRlsContext(prisma, ctx).$queryRaw`.

## Teardown

```bash
docker compose down -v    # volume deletion destroys DB data
```

In staging/prod, the Key Vault has purge protection so Key Vault cannot be recreated with the same name for 30 days after delete.
