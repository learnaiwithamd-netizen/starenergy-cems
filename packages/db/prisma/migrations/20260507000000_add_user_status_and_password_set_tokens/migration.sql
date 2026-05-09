-- Story 1.3: Admin User Management — Auditor Accounts
-- Adds:
--   1. users.status column (ACTIVE | INACTIVE) with CHECK constraint
--   2. password_set_tokens table for the welcome-email password-set flow
--   3. RLS security policy on password_set_tokens (mirrors users_policy)
--   4. Composite index on (tenant_id, status) for AC4 list-filter performance
--
-- Prisma sends the entire file as one batch (no GO processing).
-- Any statement that references a column added in the same file must be
-- wrapped in EXEC() to force deferred compilation — same pattern as
-- add_rls_and_checks. Idempotency guards handle partial prior runs.

-- ─────────────────────────────────────────────
-- 1. users.status column + CHECK constraint + index
-- ─────────────────────────────────────────────

IF COL_LENGTH('dbo.users', 'status') IS NULL
BEGIN
  ALTER TABLE [dbo].[users]
    ADD [status] NVARCHAR(20) NOT NULL CONSTRAINT DF_users_status DEFAULT 'ACTIVE';
END;

-- CHECK and INDEX reference [status], which may have been added above in this
-- same batch. Wrap in EXEC() so they compile after [status] is in the catalog.
EXEC(N'
  IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = ''ck_users_status'')
  BEGIN
    ALTER TABLE [dbo].[users]
      ADD CONSTRAINT ck_users_status
      CHECK ([status] IN (''ACTIVE'', ''INACTIVE''));
  END;
');

EXEC(N'
  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = ''idx_users_tenant_status''
      AND object_id = OBJECT_ID(''dbo.users'')
  )
  BEGIN
    CREATE NONCLUSTERED INDEX [idx_users_tenant_status]
      ON [dbo].[users]([tenant_id], [status]);
  END;
');

-- ─────────────────────────────────────────────
-- 2. password_set_tokens table
-- ─────────────────────────────────────────────

IF OBJECT_ID('dbo.password_set_tokens', 'U') IS NULL
BEGIN
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
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'uq_password_set_tokens_hash'
    AND object_id = OBJECT_ID('dbo.password_set_tokens')
)
BEGIN
  CREATE UNIQUE NONCLUSTERED INDEX [uq_password_set_tokens_hash]
    ON [dbo].[password_set_tokens]([token_hash]);
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'idx_password_set_tokens_tenant_id'
    AND object_id = OBJECT_ID('dbo.password_set_tokens')
)
BEGIN
  CREATE NONCLUSTERED INDEX [idx_password_set_tokens_tenant_id]
    ON [dbo].[password_set_tokens]([tenant_id]);
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'idx_password_set_tokens_user_id'
    AND object_id = OBJECT_ID('dbo.password_set_tokens')
)
BEGIN
  CREATE NONCLUSTERED INDEX [idx_password_set_tokens_user_id]
    ON [dbo].[password_set_tokens]([user_id]);
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_password_set_tokens_user')
BEGIN
  ALTER TABLE [dbo].[password_set_tokens]
    ADD CONSTRAINT [fk_password_set_tokens_user]
    FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id])
    ON DELETE CASCADE ON UPDATE NO ACTION;
END;

-- ─────────────────────────────────────────────
-- 3. RLS security policy on password_set_tokens
-- Reuses existing security.fn_tenant_predicate (no new function needed).
-- CREATE SECURITY POLICY must be in its own sub-batch via EXEC().
-- ─────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.security_policies WHERE name = 'password_set_tokens_policy')
  EXEC(N'
    CREATE SECURITY POLICY security.password_set_tokens_policy
      ADD FILTER PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.password_set_tokens,
      ADD BLOCK PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.password_set_tokens AFTER INSERT,
      ADD BLOCK PREDICATE security.fn_tenant_predicate(tenant_id) ON dbo.password_set_tokens BEFORE UPDATE
      WITH (STATE = ON);
  ');
