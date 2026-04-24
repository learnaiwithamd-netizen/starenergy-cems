# Prisma migrations — CEMS

Migration files in this directory are the authoritative source of the SQL Server schema. Prisma records each applied migration in `dbo._prisma_migrations`.

## Current migrations

1. **`20260424164949_init`** — 16 tables (users, user_sessions, store_refs, compressor_refs, audits, audit_sections, section_locks, audit_log, machine_rooms, racks, compressors, conventional_units, condensers, walk_ins, display_cases, controllers) with indexes + FK constraints. FK `ON DELETE NO ACTION` (SQL Server connector doesn't support Prisma's `Restrict`; `NoAction` has the same "block delete when referenced" semantics).

2. **`20260424164958_add_rls_and_checks`** — hand-authored T-SQL:
   - CHECK constraints on `users.role`, `audits.status`, `audit_log.actor_role` enforcing enum values (SQL Server connector doesn't support Prisma enums).
   - CHECK constraints on `audits.form_version` and `audits.compressor_db_version` enforcing `LEN > 0`.
   - `security` schema.
   - Predicate functions: `fn_tenant_predicate`, `fn_audits_filter`, `fn_audit_log_deny_write`. All `WITH SCHEMABINDING`.
   - 15 `SECURITY POLICY` — one per tenant-scoped table (all 16 except `compressor_refs` which is global reference data).
   - All DDL wrapped in `EXEC(N'...')` to spawn a sub-batch — T-SQL requires `CREATE SCHEMA/FUNCTION/SECURITY POLICY` to be batch-first, and Prisma runs migrations as a single batch (no `GO` processing).

## Adding a new table

1. Declare the model in `packages/db/prisma/schema.prisma` with `tenantId String @map("tenant_id")` + `@@index([tenantId])` if tenant-scoped.
2. Run `pnpm --filter @cems/db db:migrate:dev --name add_<thing>` — Prisma generates the `CREATE TABLE` migration.
3. In the same migration file, append an `EXEC(N'CREATE SECURITY POLICY security.<table>_policy ...')` block modelled on the existing policies. Tenant-scoped tables use `fn_tenant_predicate(tenant_id)`.

## Adding a column to a table referenced by a schema-bound function

Schema-bound functions (`fn_tenant_predicate`, `fn_audits_filter`, `fn_audit_log_deny_write`) lock the tables they reference. SQL Server refuses `ALTER TABLE` on columns used by `WITH SCHEMABINDING` functions until the functions are dropped.

**Runbook:**

1. `DROP SECURITY POLICY security.<table>_policy;` for every policy that uses the function.
2. `DROP FUNCTION security.fn_tenant_predicate;` (and `fn_audits_filter` / `fn_audit_log_deny_write` if the new column touches those).
3. `ALTER TABLE dbo.<table> ADD <column> ...;`
4. Recreate the function(s) (via `EXEC(N'CREATE FUNCTION ...')`).
5. Recreate the policies (via `EXEC(N'CREATE SECURITY POLICY ...')`).

Between step 2 and step 5, RLS is **disabled** on every affected table. Schedule the migration during low-traffic windows and deploy staging first.

## Resetting the dev database

`prisma migrate reset --force` is blocked by SECURITY POLICY references. Use:

```bash
docker exec cems-sql /opt/mssql-tools18/bin/sqlcmd -S localhost -U SA -P "$CEMS_SQL_SA_PASSWORD" -C \
  -Q "IF EXISTS (SELECT 1 FROM sys.databases WHERE name='cems_dev') DROP DATABASE cems_dev; CREATE DATABASE cems_dev;"

pnpm --filter @cems/db db:migrate:deploy
```

## Verifying RLS

See `packages/db/README.md § Verified behaviour` for the sqlcmd script that seeds two tenants and asserts all 5 RLS scenarios (ADMIN bypass, tenant A/B isolation, CLIENT store filter, CLIENT empty filter).

## Known limitations (tracked in deferred-work.md)

- `$queryRaw` / `$executeRaw` bypass the RLS middleware — Story 0.4 will add `withRlsTransaction(ctx, fn)` that pins a connection for the duration of a request.
- Connection-pool interleaving: middleware's 4 `sp_set_session_context` EXECs + query may land on different pooled connections. Same Story 0.4 fix.
- `$transaction` batch form skips middleware. Same fix.
