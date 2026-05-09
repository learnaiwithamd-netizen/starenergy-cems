-- Story 2.2: Store Auto-Fill & New Audit Draft Creation
-- Adds operating_hours, service_providers (JSON array), and store_manager
-- to store_refs so the GET /api/v1/stores/:storeNumber endpoint can return
-- full reference data for the audit-app auto-fill screen.
-- Story 6.1 (Reference Data Management) will expose admin UI to populate these.

IF COL_LENGTH('dbo.store_refs', 'operating_hours') IS NULL
BEGIN
  ALTER TABLE [dbo].[store_refs] ADD [operating_hours] NVARCHAR(MAX) NULL;
END;

IF COL_LENGTH('dbo.store_refs', 'service_providers') IS NULL
BEGIN
  ALTER TABLE [dbo].[store_refs] ADD [service_providers] NVARCHAR(MAX) NULL;
END;

IF COL_LENGTH('dbo.store_refs', 'store_manager') IS NULL
BEGIN
  ALTER TABLE [dbo].[store_refs] ADD [store_manager] NVARCHAR(255) NULL;
END;
