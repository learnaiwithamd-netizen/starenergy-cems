using '../../main.bicep'

param env = 'staging'
param location = 'canadacentral'

param tenantId = '73496e97-7769-4b4e-a5bf-e6efb3c445c0'

// Non-overlapping VNet per env for future peering
param vnetAddressPrefix = '10.20.0.0/16'
param appsSubnetPrefix = '10.20.1.0/24'
param containersSubnetPrefix = '10.20.2.0/23'
param dataSubnetPrefix = '10.20.4.0/24'

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

param appServicePlanSku = 'B2'

// Container Apps: prod-sized but can still scale to zero
param containerAppsConfig = {
  cpu: '0.5'
  memory: '1Gi'
  minReplicas: 0
  maxReplicas: 3
}

param acrSku = 'Standard'
param calcServiceImageTag = 'latest'

param staticWebAppsLocation = 'eastus2'
param appInsightsRetentionDays = 90

param sqlAdminPassword = readEnvironmentVariable('CEMS_SQL_ADMIN_PASSWORD', 'REPLACE_BEFORE_DEPLOY_use_deploy.sh_with_env_var')

// Staging mirrors prod: no "Allow Azure services", no dev IP allowlist, VNet-only
param enableSqlAllowAzureServices = false
param sqlFirewallIpRanges = []

// Threat detection ON
param enableSqlThreatDetection = true

// Purge protection REQUIRED for staging (production-mirror)
param enableKeyVaultPurgeProtection = true
param keyVaultSoftDeleteRetentionDays = 30

param swaCorsOrigins = []

param extraTags = {
  tier: 'staging'
}
