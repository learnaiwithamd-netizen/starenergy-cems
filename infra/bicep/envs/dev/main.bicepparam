using '../../main.bicep'

param env = 'dev'
param location = 'canadacentral'

// Replace with your Azure tenant id before deploying
param tenantId = '00000000-0000-0000-0000-000000000000'

// SQL: S2 for dev
param sqlSku = {
  name: 'S2'
  tier: 'Standard'
}

// Redis: Basic C0 (250MB) — cheapest tier for dev
param redisSku = {
  name: 'Basic'
  family: 'C'
  capacity: 0
}

// App Service: B2 for dev
param appServicePlanSku = 'B2'

// Container Apps: minimal footprint, scale to zero when idle
param containerAppsConfig = {
  cpu: '0.25'
  memory: '0.5Gi'
  minReplicas: 0
  maxReplicas: 1
}

param staticWebAppsLocation = 'eastus2'
param appInsightsRetentionDays = 30

// Seeded via --parameters sqlAdminPassword="..." on the command line
// or via environment variable; do NOT commit the real value
param sqlAdminPassword = readEnvironmentVariable('CEMS_SQL_ADMIN_PASSWORD', 'REPLACE_BEFORE_DEPLOY_use_deploy.sh_with_env_var')

// Dev convenience: allowlist developer workstation IPs (set via env, empty array by default)
param sqlFirewallIpRanges = []

// Threat detection off in dev (cost)
param enableSqlThreatDetection = false

// Purge protection OFF in dev — lets us delete & recreate the vault during iteration
param enableKeyVaultPurgeProtection = false
param keyVaultSoftDeleteRetentionDays = 7

param extraTags = {
  tier: 'development'
}
