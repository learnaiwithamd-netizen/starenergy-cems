BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[users] (
    [id] NVARCHAR(1000) NOT NULL,
    [tenant_id] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [role] NVARCHAR(20) NOT NULL,
    [password_hash] NVARCHAR(1000) NOT NULL,
    [assigned_store_ids] NVARCHAR(max) NOT NULL CONSTRAINT [users_assigned_store_ids_df] DEFAULT '[]',
    [created_at] DATETIME2 NOT NULL CONSTRAINT [users_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [users_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [uq_users_tenant_email] UNIQUE NONCLUSTERED ([tenant_id],[email])
);

-- CreateTable
CREATE TABLE [dbo].[user_sessions] (
    [id] NVARCHAR(1000) NOT NULL,
    [user_id] NVARCHAR(1000) NOT NULL,
    [refresh_token_hash] NVARCHAR(1000) NOT NULL,
    [expires_at] DATETIME2 NOT NULL,
    [revoked_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [user_sessions_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [user_sessions_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [uq_sessions_refresh_hash] UNIQUE NONCLUSTERED ([refresh_token_hash])
);

-- CreateTable
CREATE TABLE [dbo].[store_refs] (
    [id] NVARCHAR(1000) NOT NULL,
    [tenant_id] NVARCHAR(1000) NOT NULL,
    [store_number] NVARCHAR(1000) NOT NULL,
    [store_name] NVARCHAR(1000),
    [address] NVARCHAR(1000),
    [banner] NVARCHAR(1000),
    [region] NVARCHAR(1000),
    [postal_code] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [store_refs_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [store_refs_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [uq_stores_tenant_number] UNIQUE NONCLUSTERED ([tenant_id],[store_number])
);

-- CreateTable
CREATE TABLE [dbo].[compressor_refs] (
    [id] NVARCHAR(1000) NOT NULL,
    [compressor_db_version] NVARCHAR(1000) NOT NULL,
    [model_number] NVARCHAR(1000) NOT NULL,
    [manufacturer] NVARCHAR(1000) NOT NULL,
    [refrigerant_type] NVARCHAR(1000) NOT NULL,
    [regression_coefficients] NVARCHAR(max) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [compressor_refs_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [compressor_refs_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [uq_compressors_version_model] UNIQUE NONCLUSTERED ([compressor_db_version],[model_number])
);

-- CreateTable
CREATE TABLE [dbo].[audits] (
    [id] NVARCHAR(1000) NOT NULL,
    [tenant_id] NVARCHAR(1000) NOT NULL,
    [client_id] NVARCHAR(1000) NOT NULL,
    [store_id] NVARCHAR(1000) NOT NULL,
    [auditor_user_id] NVARCHAR(1000),
    [status] NVARCHAR(30) NOT NULL CONSTRAINT [audits_status_df] DEFAULT 'DRAFT',
    [current_section_id] NVARCHAR(1000),
    [form_version] NVARCHAR(1000) NOT NULL,
    [compressor_db_version] NVARCHAR(1000) NOT NULL,
    [general_data] NVARCHAR(max),
    [hvac_data] NVARCHAR(max),
    [lighting_data] NVARCHAR(max),
    [building_envelope_data] NVARCHAR(max),
    [submitted_at] DATETIME2,
    [approved_at] DATETIME2,
    [published_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [audits_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [audits_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[audit_sections] (
    [id] NVARCHAR(1000) NOT NULL,
    [tenant_id] NVARCHAR(1000) NOT NULL,
    [audit_id] NVARCHAR(1000) NOT NULL,
    [section_id] NVARCHAR(1000) NOT NULL,
    [data] NVARCHAR(max) NOT NULL,
    [completed_at] DATETIME2,
    [completed_by_user_id] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [audit_sections_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [audit_sections_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [uq_sections_audit_section] UNIQUE NONCLUSTERED ([audit_id],[section_id])
);

-- CreateTable
CREATE TABLE [dbo].[section_locks] (
    [id] NVARCHAR(1000) NOT NULL,
    [tenant_id] NVARCHAR(1000) NOT NULL,
    [audit_id] NVARCHAR(1000) NOT NULL,
    [section_id] NVARCHAR(1000) NOT NULL,
    [user_id] NVARCHAR(1000) NOT NULL,
    [acquired_at] DATETIME2 NOT NULL CONSTRAINT [section_locks_acquired_at_df] DEFAULT CURRENT_TIMESTAMP,
    [expires_at] DATETIME2 NOT NULL,
    [heartbeat_at] DATETIME2 NOT NULL CONSTRAINT [section_locks_heartbeat_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [section_locks_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [uq_locks_audit_section] UNIQUE NONCLUSTERED ([audit_id],[section_id])
);

-- CreateTable
CREATE TABLE [dbo].[audit_log] (
    [id] NVARCHAR(1000) NOT NULL,
    [tenant_id] NVARCHAR(1000) NOT NULL,
    [audit_id] NVARCHAR(1000),
    [event_type] NVARCHAR(1000) NOT NULL,
    [payload] NVARCHAR(max) NOT NULL,
    [actor_user_id] NVARCHAR(1000),
    [actor_role] NVARCHAR(1000),
    [occurred_at] DATETIME2 NOT NULL CONSTRAINT [audit_log_occurred_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [audit_log_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[machine_rooms] (
    [id] NVARCHAR(1000) NOT NULL,
    [tenant_id] NVARCHAR(1000) NOT NULL,
    [audit_id] NVARCHAR(1000) NOT NULL,
    [room_number] NVARCHAR(1000) NOT NULL,
    [data] NVARCHAR(max) NOT NULL CONSTRAINT [machine_rooms_data_df] DEFAULT '{}',
    [created_at] DATETIME2 NOT NULL CONSTRAINT [machine_rooms_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [machine_rooms_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [uq_machineroom_audit_num] UNIQUE NONCLUSTERED ([audit_id],[room_number])
);

-- CreateTable
CREATE TABLE [dbo].[racks] (
    [id] NVARCHAR(1000) NOT NULL,
    [tenant_id] NVARCHAR(1000) NOT NULL,
    [machine_room_id] NVARCHAR(1000) NOT NULL,
    [rack_number] NVARCHAR(1000) NOT NULL,
    [data] NVARCHAR(max) NOT NULL CONSTRAINT [racks_data_df] DEFAULT '{}',
    [created_at] DATETIME2 NOT NULL CONSTRAINT [racks_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [racks_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [uq_rack_room_num] UNIQUE NONCLUSTERED ([machine_room_id],[rack_number])
);

-- CreateTable
CREATE TABLE [dbo].[compressors] (
    [id] NVARCHAR(1000) NOT NULL,
    [tenant_id] NVARCHAR(1000) NOT NULL,
    [rack_id] NVARCHAR(1000) NOT NULL,
    [compressor_number] NVARCHAR(1000) NOT NULL,
    [compressor_ref_id] NVARCHAR(1000),
    [data] NVARCHAR(max) NOT NULL CONSTRAINT [compressors_data_df] DEFAULT '{}',
    [created_at] DATETIME2 NOT NULL CONSTRAINT [compressors_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [compressors_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[conventional_units] (
    [id] NVARCHAR(1000) NOT NULL,
    [tenant_id] NVARCHAR(1000) NOT NULL,
    [machine_room_id] NVARCHAR(1000) NOT NULL,
    [unit_number] NVARCHAR(1000) NOT NULL,
    [data] NVARCHAR(max) NOT NULL CONSTRAINT [conventional_units_data_df] DEFAULT '{}',
    [created_at] DATETIME2 NOT NULL CONSTRAINT [conventional_units_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [conventional_units_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[condensers] (
    [id] NVARCHAR(1000) NOT NULL,
    [tenant_id] NVARCHAR(1000) NOT NULL,
    [machine_room_id] NVARCHAR(1000) NOT NULL,
    [condenser_number] NVARCHAR(1000) NOT NULL,
    [data] NVARCHAR(max) NOT NULL CONSTRAINT [condensers_data_df] DEFAULT '{}',
    [created_at] DATETIME2 NOT NULL CONSTRAINT [condensers_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [condensers_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[walk_ins] (
    [id] NVARCHAR(1000) NOT NULL,
    [tenant_id] NVARCHAR(1000) NOT NULL,
    [audit_id] NVARCHAR(1000) NOT NULL,
    [walk_in_number] NVARCHAR(1000) NOT NULL,
    [data] NVARCHAR(max) NOT NULL CONSTRAINT [walk_ins_data_df] DEFAULT '{}',
    [created_at] DATETIME2 NOT NULL CONSTRAINT [walk_ins_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [walk_ins_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[display_cases] (
    [id] NVARCHAR(1000) NOT NULL,
    [tenant_id] NVARCHAR(1000) NOT NULL,
    [rack_id] NVARCHAR(1000) NOT NULL,
    [display_case_number] NVARCHAR(1000) NOT NULL,
    [data] NVARCHAR(max) NOT NULL CONSTRAINT [display_cases_data_df] DEFAULT '{}',
    [created_at] DATETIME2 NOT NULL CONSTRAINT [display_cases_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [display_cases_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[controllers] (
    [id] NVARCHAR(1000) NOT NULL,
    [tenant_id] NVARCHAR(1000) NOT NULL,
    [audit_id] NVARCHAR(1000) NOT NULL,
    [controller_number] NVARCHAR(1000) NOT NULL,
    [data] NVARCHAR(max) NOT NULL CONSTRAINT [controllers_data_df] DEFAULT '{}',
    [created_at] DATETIME2 NOT NULL CONSTRAINT [controllers_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [controllers_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_users_tenant_id] ON [dbo].[users]([tenant_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_sessions_user_id] ON [dbo].[user_sessions]([user_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_stores_tenant_id] ON [dbo].[store_refs]([tenant_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_compressors_version] ON [dbo].[compressor_refs]([compressor_db_version]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_audits_tenant_id] ON [dbo].[audits]([tenant_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_audits_client_id] ON [dbo].[audits]([client_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_audits_store_id] ON [dbo].[audits]([store_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_audits_status] ON [dbo].[audits]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_sections_tenant_id] ON [dbo].[audit_sections]([tenant_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_locks_tenant_id] ON [dbo].[section_locks]([tenant_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_locks_expires_at] ON [dbo].[section_locks]([expires_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_log_tenant_id] ON [dbo].[audit_log]([tenant_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_log_audit_id] ON [dbo].[audit_log]([audit_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_log_occurred_at] ON [dbo].[audit_log]([occurred_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_machineroom_tenant_id] ON [dbo].[machine_rooms]([tenant_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_rack_tenant_id] ON [dbo].[racks]([tenant_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_comp_tenant_id] ON [dbo].[compressors]([tenant_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_convunit_tenant_id] ON [dbo].[conventional_units]([tenant_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_cond_tenant_id] ON [dbo].[condensers]([tenant_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_walkin_tenant_id] ON [dbo].[walk_ins]([tenant_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_case_tenant_id] ON [dbo].[display_cases]([tenant_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_controller_tenant_id] ON [dbo].[controllers]([tenant_id]);

-- AddForeignKey
ALTER TABLE [dbo].[user_sessions] ADD CONSTRAINT [fk_sessions_user] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[audits] ADD CONSTRAINT [fk_audits_store] FOREIGN KEY ([store_id]) REFERENCES [dbo].[store_refs]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[audits] ADD CONSTRAINT [fk_audits_auditor] FOREIGN KEY ([auditor_user_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[audit_sections] ADD CONSTRAINT [fk_sections_audit] FOREIGN KEY ([audit_id]) REFERENCES [dbo].[audits]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[audit_sections] ADD CONSTRAINT [fk_sections_user] FOREIGN KEY ([completed_by_user_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[section_locks] ADD CONSTRAINT [fk_locks_audit] FOREIGN KEY ([audit_id]) REFERENCES [dbo].[audits]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[section_locks] ADD CONSTRAINT [fk_locks_user] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_log] ADD CONSTRAINT [fk_log_audit] FOREIGN KEY ([audit_id]) REFERENCES [dbo].[audits]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_log] ADD CONSTRAINT [fk_log_actor] FOREIGN KEY ([actor_user_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[machine_rooms] ADD CONSTRAINT [fk_machineroom_audit] FOREIGN KEY ([audit_id]) REFERENCES [dbo].[audits]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[racks] ADD CONSTRAINT [fk_rack_room] FOREIGN KEY ([machine_room_id]) REFERENCES [dbo].[machine_rooms]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[compressors] ADD CONSTRAINT [fk_comp_rack] FOREIGN KEY ([rack_id]) REFERENCES [dbo].[racks]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[compressors] ADD CONSTRAINT [fk_comp_ref] FOREIGN KEY ([compressor_ref_id]) REFERENCES [dbo].[compressor_refs]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[conventional_units] ADD CONSTRAINT [fk_convunit_room] FOREIGN KEY ([machine_room_id]) REFERENCES [dbo].[machine_rooms]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[condensers] ADD CONSTRAINT [fk_cond_room] FOREIGN KEY ([machine_room_id]) REFERENCES [dbo].[machine_rooms]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[walk_ins] ADD CONSTRAINT [fk_walkin_audit] FOREIGN KEY ([audit_id]) REFERENCES [dbo].[audits]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[display_cases] ADD CONSTRAINT [fk_case_rack] FOREIGN KEY ([rack_id]) REFERENCES [dbo].[racks]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[controllers] ADD CONSTRAINT [fk_controller_audit] FOREIGN KEY ([audit_id]) REFERENCES [dbo].[audits]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
