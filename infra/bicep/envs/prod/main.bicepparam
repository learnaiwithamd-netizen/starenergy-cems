using '../../main.bicep'

param env = 'prod'
param location = 'canadacentral'

param tenantId = '00000000-0000-0000-0000-000000000000'

// Non-overlapping VNet per env for future peering
param vnetAddressPrefix = '10.30.0.0/16'
param appsSubnetPrefix = '10.30.1.0/24'
param containersSubnetPrefix = '10.30.2.0/23'
param dataSubnetPrefix = '10.30.4.0/24'

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

// Prod: VNet-only access; NO public Azure services firewall rule
param enableSqlAllowAzureServices = false
param sqlFirewallIpRanges = []
param enableSqlThreatDetection = true
param enableKeyVaultPurgeProtection = true
param keyVaultSoftDeleteRetentionDays = 30

param swaCorsOrigins = []

param extraTags = {
  tier: 'production'
  pii: 'tenant-isolated'
}
