-- Story 1.3: Admin User Management — Auditor Accounts
-- Adds:
--   1. users.status column (ACTIVE | INACTIVE) with CHECK constraint
--   2. password_set_tokens table for the welcome-email password-set flow
--   3. RLS security policy on password_set_tokens (mirrors users_policy)
--   4. Composite index on (tenant_id, status) for AC4 list-filter performance
--
-- Hand-authored to combine the auto-generated DDL with the project's
-- check-constraint + RLS-policy patterns from the 0-3 add_rls_and_checks
-- migration. Do NOT regenerate via `prisma migrate dev` without re-applying
-- the EXEC blocks below.

-- ─────────────────────────────────────────────
-- 1. users.status column + CHECK constraint
-- ─────────────────────────────────────────────

ALTER TABLE [dbo].[users]
  ADD [status] NVARCHAR(20) NOT NULL CONSTRAINT DF_users_status DEFAULT 'ACTIVE';
GO

ALTER TABLE [dbo].[users]
  ADD CONSTRAINT ck_users_status
  CHECK ([status] IN ('ACTIVE', 'INACTIVE'));
GO

CREATE NONCLUSTERED INDEX [idx_users_tenant_status]
  ON [dbo].[users]([tenant_id], [status]);
GO

-- ─────────────────────────────────────────────
-- 2. password_set_tokens table
-- ─────────────────────────────────────────────

CREATE TABLE [dbo].[password_set_tokens] (
  [id]          NVARCHAR(1000) NOT NULL,
  [tenant_id]   NVARCHAR(1000) NOT NULL,
  [user_id]     NVARCHAR(1000) NOT NULL,
  [token_hash]  NVARCHAR(1000) NOT NULL,
  [expires_at]  DATETIME2      NOT NULL,
  [used_at]     DATETIME2      NULL,
  [created_at]  DATETIME2      NOT NULL CONSTRAINT [DF_password_set_tokens_created_at] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [password_set_tokens_pkey] PRIMARY KEY CLUSTERED ([id])
);
GO

CREATE UNIQUE NONCLUSTERED INDEX [uq_password_set_tokens_hash]
  ON [dbo].[password_set_tokens]([token_hash]);
GO

CREATE NONCLUSTERED INDEX [idx_password_set_tokens_tenant_id]
  ON [dbo].[password_set_tokens]([tenant_id]);
GO

CREATE NONCLUSTERED INDEX [idx_password_set_tokens_user_id]
  ON [dbo].[password_set_tokens]([user_id]);
GO

ALTER TABLE [dbo].[password_set_tokens]
  ADD CONSTRAINT [fk_password_set_tokens_user]
  FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id])
  ON DELETE CASCADE ON UPDATE NO ACTION;
GO

-- ─────────────────────────────────────────────
-- 3. RLS security policy on password_set_tokens
-- Mirrors security.users_policy / user_sessions_policy from
-- 20260424164958_add_rls_and_checks/migration.sql. Reuses the existing
-- security.fn_tenant_predicate (no new function needed).
-- ─────────────────────────────────────────────

EXEC(N'
CREATE SECURITY POLICY security.password_set_tokens_policy
  ADD FILTER PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.password_set_tokens,
  ADD BLOCK PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.password_set_tokens AFTER INSERT,
  ADD BLOCK PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.password_set_tokens BEFORE UPDATE
  WITH (STATE = ON);
');
GO
