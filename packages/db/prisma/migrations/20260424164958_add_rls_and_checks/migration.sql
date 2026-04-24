-- add_rls_and_checks
-- Azure SQL Row-Level Security via SESSION_CONTEXT + CHECK constraints for String-backed enums.
-- Every tenant-scoped table gets a tenant predicate (filters + blocks on tenant_id).
-- The `audits` table gets an additional client-role predicate filtered by assigned_store_ids.
-- compressor_refs is GLOBAL reference data — no RLS policy applied.
--
-- Implementation note: SQL Server requires CREATE SCHEMA / CREATE FUNCTION / CREATE SECURITY POLICY
-- to be the first statement in their batch. Prisma migrations execute as a single batch
-- (no GO separator processing), so we wrap these statements in EXEC('...') to spawn a sub-batch.
--
-- Hardening notes (code review 2026-04-25):
--   * UPPER() on role comparisons — defensive against case-sensitive collations
--   * COALESCE(..., '[]') on assigned_store_ids OPENJSON input — prevents Msg 13609 on NULL
--   * audit_log policy BLOCKs UPDATE + DELETE via a dedicated deny predicate — truly append-only
--   * user_sessions gets a tenant_id + policy — cross-tenant refresh-token leak fix
--   * CHECK on audit_log.actor_role — enum enforcement parity
--   * CHECK on audits.form_version / compressor_db_version — LEN > 0 (AC 5 spirit)

-- ─────────────────────────────────────────────
-- CHECK constraints for String-backed enums + AC 5 spirit
-- ─────────────────────────────────────────────

ALTER TABLE dbo.users
  ADD CONSTRAINT ck_users_role
  CHECK (UPPER(role) IN ('ADMIN', 'AUDITOR', 'CLIENT'));

ALTER TABLE dbo.audits
  ADD CONSTRAINT ck_audits_status
  CHECK (status IN (
    'DRAFT', 'SUBMITTED', 'IN_REVIEW', 'CALC_IN_PROGRESS',
    'CALC_COMPLETE', 'MANUAL_REVIEW_REQUIRED', 'APPROVED', 'PUBLISHED'
  ));

-- AC 5 spirit — reject inserts that "omit" either field (empty string counts)
ALTER TABLE dbo.audits
  ADD CONSTRAINT ck_audits_form_version_nonempty
  CHECK (LEN(form_version) > 0);

ALTER TABLE dbo.audits
  ADD CONSTRAINT ck_audits_compressor_db_version_nonempty
  CHECK (LEN(compressor_db_version) > 0);

-- Enum parity for audit log actor
ALTER TABLE dbo.audit_log
  ADD CONSTRAINT ck_audit_log_actor_role
  CHECK (actor_role IS NULL OR UPPER(actor_role) IN ('ADMIN', 'AUDITOR', 'CLIENT'));

-- ─────────────────────────────────────────────
-- security schema
-- ─────────────────────────────────────────────

EXEC('CREATE SCHEMA security');

-- ─────────────────────────────────────────────
-- Predicate functions (case-insensitive role compare; NULL-safe OPENJSON)
-- ─────────────────────────────────────────────

EXEC(N'
CREATE FUNCTION security.fn_tenant_predicate(@tenant_id NVARCHAR(4000))
  RETURNS TABLE
  WITH SCHEMABINDING
AS
  RETURN SELECT 1 AS fn_result
  WHERE @tenant_id = CAST(SESSION_CONTEXT(N''tenant_id'') AS NVARCHAR(4000))
     OR UPPER(CAST(SESSION_CONTEXT(N''user_role'') AS NVARCHAR(20))) = N''ADMIN'';
');

-- Combined audits filter: tenant check AND (role != CLIENT OR store_id in assigned_store_ids).
-- SQL Server allows only ONE FILTER predicate per table per policy, so we combine.
-- COALESCE guards against NULL SESSION_CONTEXT('assigned_store_ids') which would otherwise
-- raise Msg 13609 on OPENJSON input and fail-closed every CLIENT query.
-- Empty-string element guard: LEN(value) > 0 prevents ['']-bypass.
EXEC(N'
CREATE FUNCTION security.fn_audits_filter(@tenant_id NVARCHAR(4000), @store_id NVARCHAR(4000))
  RETURNS TABLE
  WITH SCHEMABINDING
AS
  RETURN SELECT 1 AS fn_result
  WHERE (
    @tenant_id = CAST(SESSION_CONTEXT(N''tenant_id'') AS NVARCHAR(4000))
      OR UPPER(CAST(SESSION_CONTEXT(N''user_role'') AS NVARCHAR(20))) = N''ADMIN''
  )
  AND (
    UPPER(CAST(SESSION_CONTEXT(N''user_role'') AS NVARCHAR(20))) <> N''CLIENT''
      OR EXISTS (
        SELECT 1
        FROM OPENJSON(COALESCE(CAST(SESSION_CONTEXT(N''assigned_store_ids'') AS NVARCHAR(MAX)), N''[]''))
        WHERE LEN(value) > 0 AND value = @store_id
      )
  );
');

-- Deny-all predicate for audit_log UPDATE/DELETE — append-only at the DB layer.
EXEC(N'
CREATE FUNCTION security.fn_audit_log_deny_write(@tenant_id NVARCHAR(4000))
  RETURNS TABLE
  WITH SCHEMABINDING
AS
  RETURN SELECT 1 AS fn_result
  WHERE 1 = 0;
');

-- ─────────────────────────────────────────────
-- Security policies — one per tenant-scoped table
-- ─────────────────────────────────────────────

EXEC(N'
CREATE SECURITY POLICY security.users_policy
  ADD FILTER PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.users,
  ADD BLOCK PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.users AFTER INSERT,
  ADD BLOCK PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.users BEFORE UPDATE
  WITH (STATE = ON);
');

EXEC(N'
CREATE SECURITY POLICY security.user_sessions_policy
  ADD FILTER PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.user_sessions,
  ADD BLOCK PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.user_sessions AFTER INSERT,
  ADD BLOCK PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.user_sessions BEFORE UPDATE
  WITH (STATE = ON);
');

EXEC(N'
CREATE SECURITY POLICY security.store_refs_policy
  ADD FILTER PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.store_refs,
  ADD BLOCK PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.store_refs AFTER INSERT,
  ADD BLOCK PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.store_refs BEFORE UPDATE
  WITH (STATE = ON);
');

EXEC(N'
CREATE SECURITY POLICY security.audits_policy
  ADD FILTER PREDICATE security.fn_audits_filter(tenant_id, store_id) ON dbo.audits,
  ADD BLOCK PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.audits AFTER INSERT,
  ADD BLOCK PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.audits BEFORE UPDATE
  WITH (STATE = ON);
');

EXEC(N'
CREATE SECURITY POLICY security.audit_sections_policy
  ADD FILTER PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.audit_sections,
  ADD BLOCK PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.audit_sections AFTER INSERT,
  ADD BLOCK PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.audit_sections BEFORE UPDATE
  WITH (STATE = ON);
');

EXEC(N'
CREATE SECURITY POLICY security.section_locks_policy
  ADD FILTER PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.section_locks,
  ADD BLOCK PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.section_locks AFTER INSERT,
  ADD BLOCK PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.section_locks BEFORE UPDATE
  WITH (STATE = ON);
');

-- audit_log — truly append-only: tenant filter on read, tenant block on insert,
-- deny-all on update + delete.
EXEC(N'
CREATE SECURITY POLICY security.audit_log_policy
  ADD FILTER PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.audit_log,
  ADD BLOCK PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.audit_log AFTER INSERT,
  ADD BLOCK PREDICATE security.fn_audit_log_deny_write(tenant_id) ON dbo.audit_log BEFORE UPDATE,
  ADD BLOCK PREDICATE security.fn_audit_log_deny_write(tenant_id) ON dbo.audit_log BEFORE DELETE
  WITH (STATE = ON);
');

EXEC(N'
CREATE SECURITY POLICY security.machine_rooms_policy
  ADD FILTER PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.machine_rooms,
  ADD BLOCK PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.machine_rooms AFTER INSERT,
  ADD BLOCK PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.machine_rooms BEFORE UPDATE
  WITH (STATE = ON);
');

EXEC(N'
CREATE SECURITY POLICY security.racks_policy
  ADD FILTER PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.racks,
  ADD BLOCK PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.racks AFTER INSERT,
  ADD BLOCK PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.racks BEFORE UPDATE
  WITH (STATE = ON);
');

EXEC(N'
CREATE SECURITY POLICY security.compressors_policy
  ADD FILTER PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.compressors,
  ADD BLOCK PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.compressors AFTER INSERT,
  ADD BLOCK PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.compressors BEFORE UPDATE
  WITH (STATE = ON);
');

EXEC(N'
CREATE SECURITY POLICY security.conventional_units_policy
  ADD FILTER PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.conventional_units,
  ADD BLOCK PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.conventional_units AFTER INSERT,
  ADD BLOCK PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.conventional_units BEFORE UPDATE
  WITH (STATE = ON);
');

EXEC(N'
CREATE SECURITY POLICY security.condensers_policy
  ADD FILTER PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.condensers,
  ADD BLOCK PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.condensers AFTER INSERT,
  ADD BLOCK PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.condensers BEFORE UPDATE
  WITH (STATE = ON);
');

EXEC(N'
CREATE SECURITY POLICY security.walk_ins_policy
  ADD FILTER PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.walk_ins,
  ADD BLOCK PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.walk_ins AFTER INSERT,
  ADD BLOCK PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.walk_ins BEFORE UPDATE
  WITH (STATE = ON);
');

EXEC(N'
CREATE SECURITY POLICY security.display_cases_policy
  ADD FILTER PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.display_cases,
  ADD BLOCK PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.display_cases AFTER INSERT,
  ADD BLOCK PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.display_cases BEFORE UPDATE
  WITH (STATE = ON);
');

EXEC(N'
CREATE SECURITY POLICY security.controllers_policy
  ADD FILTER PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.controllers,
  ADD BLOCK PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.controllers AFTER INSERT,
  ADD BLOCK PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.controllers BEFORE UPDATE
  WITH (STATE = ON);
');
