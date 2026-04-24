using '../../main.bicep'

param env = 'staging'
param location = 'canadacentral'

param tenantId = '00000000-0000-0000-0000-000000000000'

param sqlSku = {
  name: 'S2'
  tier: 'Standard'
}

// Redis: Standard C1 (1GB) for staging+prod parity
param redisSku = {
  name: 'Standard'
  family: 'C'
  capacity: 1
}

// App Service: B2 (matches dev; prod upgrades to B3)
param appServicePlanSku = 'B2'

// Container Apps: prod-sized but can still scale to zero
param containerAppsConfig = {
  cpu: '0.5'
  memory: '1Gi'
  minReplicas: 0
  maxReplicas: 3
}

param staticWebAppsLocation = 'eastus2'
param appInsightsRetentionDays = 90

param sqlAdminPassword = readEnvironmentVariable('CEMS_SQL_ADMIN_PASSWORD', 'REPLACE_BEFORE_DEPLOY_use_deploy.sh_with_env_var')

// No dev IP allowlist in staging — traffic via App Service + VNet only
param sqlFirewallIpRanges = []

// Threat detection ON
param enableSqlThreatDetection = true

// Purge protection REQUIRED for staging (production-mirror)
param enableKeyVaultPurgeProtection = true
param keyVaultSoftDeleteRetentionDays = 30

param extraTags = {
  tier: 'staging'
}
