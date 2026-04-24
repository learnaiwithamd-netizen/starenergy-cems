using '../../main.bicep'

param env = 'dev'
param location = 'canadacentral'

// Replace with your Azure tenant id before deploying (deploy.sh validates this isn't the placeholder)
param tenantId = '00000000-0000-0000-0000-000000000000'

// Non-overlapping VNet per env for future peering
param vnetAddressPrefix = '10.10.0.0/16'
param appsSubnetPrefix = '10.10.1.0/24'
param containersSubnetPrefix = '10.10.2.0/23'
param dataSubnetPrefix = '10.10.4.0/24'

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

// deploy.sh validates this and refuses the placeholder before deployment
param sqlAdminPassword = readEnvironmentVariable('CEMS_SQL_ADMIN_PASSWORD', 'REPLACE_BEFORE_DEPLOY_use_deploy.sh_with_env_var')

// Dev convenience only — allow Azure services to reach SQL (still requires credentials)
param enableSqlAllowAzureServices = true
param sqlFirewallIpRanges = []

// Threat detection off in dev (cost)
param enableSqlThreatDetection = false

// Purge protection OFF in dev — lets us delete & recreate the vault during iteration
param enableKeyVaultPurgeProtection = false
param keyVaultSoftDeleteRetentionDays = 7

// CORS empty on first deploy; populate after SWA hostnames are known
param swaCorsOrigins = []

param extraTags = {
  tier: 'development'
}
