using '../../main.bicep'

param env = 'prod'
param location = 'canadacentral'

param tenantId = '00000000-0000-0000-0000-000000000000'

param sqlSku = {
  name: 'S2'
  tier: 'Standard'
}

param redisSku = {
  name: 'Standard'
  family: 'C'
  capacity: 1
}

// Prod upgrades App Service Plan to B3
param appServicePlanSku = 'B3'

// Prod: always-on calc-service, higher replica ceiling
param containerAppsConfig = {
  cpu: '0.5'
  memory: '1Gi'
  minReplicas: 1
  maxReplicas: 10
}

param staticWebAppsLocation = 'eastus2'
param appInsightsRetentionDays = 90

param sqlAdminPassword = readEnvironmentVariable('CEMS_SQL_ADMIN_PASSWORD', 'REPLACE_BEFORE_DEPLOY_use_deploy.sh_with_env_var')

param sqlFirewallIpRanges = []
param enableSqlThreatDetection = true
param enableKeyVaultPurgeProtection = true
param keyVaultSoftDeleteRetentionDays = 30

param extraTags = {
  tier: 'production'
  pii: 'tenant-isolated'
}
