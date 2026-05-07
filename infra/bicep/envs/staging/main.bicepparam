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

// Reuse the dev Container Apps Environment — subscription is limited to 1 per region.
// Replace with a dedicated staging CAE once the quota is raised or a second subscription is available.
param existingCaeResourceId = '/subscriptions/7a1afd60-8ba6-49af-bec3-519cae2ee295/resourceGroups/cems-dev-rg/providers/Microsoft.App/managedEnvironments/cems-dev-cae'

// Public placeholder image for initial bootstrap — avoids AcrPull RBAC race condition.
// CI (deploy-staging.yml) updates this to the real ACR image on every push to main.
param calcServiceImageOverride = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

// Allow public KV access so GitHub Actions runners can read secrets during CI/CD.
// Prod should use private endpoints; staging uses public access for simplicity.
param kvNetworkDefaultAction = 'Allow'

param extraTags = {
  tier: 'staging'
}
