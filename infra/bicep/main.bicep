// main.bicep — CEMS infrastructure composition (subscription scope → creates RG + all resources)
// Invoke: az deployment sub create --location canadacentral --template-file main.bicep --parameters envs/<env>/main.bicepparam

targetScope = 'subscription'

@description('Environment name (dev | staging | prod)')
@allowed(['dev', 'staging', 'prod'])
param env string

@description('Primary Azure region (pinned canadacentral)')
param location string = 'canadacentral'

@description('Azure tenant id for Key Vault')
param tenantId string

@description('SQL SKU object')
param sqlSku object = {
  name: 'S2'
  tier: 'Standard'
}

@description('Redis SKU')
param redisSku object = {
  name: 'Basic'
  family: 'C'
  capacity: 0
}

@description('App Service Plan SKU')
param appServicePlanSku string = 'B2'

@description('Container Apps CPU/memory/scale settings')
param containerAppsConfig object = {
  cpu: '0.25'
  memory: '0.5Gi'
  minReplicas: 0
  maxReplicas: 1
}

@description('Static Web Apps region (fallback eastus2 due to SWA availability)')
param staticWebAppsLocation string = 'eastus2'

@description('Application Insights retention days')
param appInsightsRetentionDays int = 30

@description('SQL admin password seeded into Key Vault — rotate after first deploy')
@secure()
param sqlAdminPassword string

@description('Dev-only firewall IP allowlist; empty in staging/prod')
param sqlFirewallIpRanges array = []

@description('Enable SQL threat detection (staging + prod only)')
param enableSqlThreatDetection bool = false

@description('Enable Key Vault purge protection (staging + prod only)')
param enableKeyVaultPurgeProtection bool = false

@description('Key Vault soft-delete retention days')
param keyVaultSoftDeleteRetentionDays int = 30

@description('Additional resource tags on top of the defaults')
param extraTags object = {}

var tags = union(
  {
    app: 'cems'
    env: env
    owner: 'star-energy'
    costCenter: 'star-energy-cems'
    managedBy: 'bicep'
  },
  extraTags
)

var rgName = 'cems-${env}-rg'

resource rg 'Microsoft.Resources/resourceGroups@2024-11-01' = {
  name: rgName
  location: location
  tags: tags
}

module network 'modules/network.bicep' = {
  scope: rg
  name: 'network-${env}'
  params: {
    env: env
    location: location
    tags: tags
  }
}

module keyVault 'modules/keyvault.bicep' = {
  scope: rg
  name: 'kv-${env}'
  params: {
    env: env
    location: location
    tags: tags
    tenantId: tenantId
    enablePurgeProtection: enableKeyVaultPurgeProtection
    softDeleteRetentionInDays: keyVaultSoftDeleteRetentionDays
  }
}

module sql 'modules/sql.bicep' = {
  scope: rg
  name: 'sql-${env}'
  params: {
    env: env
    location: location
    tags: tags
    sqlSkuName: sqlSku.name
    sqlTier: sqlSku.tier
    adminPassword: sqlAdminPassword
    enableThreatDetection: enableSqlThreatDetection
    allowedIpRanges: sqlFirewallIpRanges
  }
}

module redis 'modules/redis.bicep' = {
  scope: rg
  name: 'redis-${env}'
  params: {
    env: env
    location: location
    tags: tags
    sku: redisSku
  }
}

module storage 'modules/storage.bicep' = {
  scope: rg
  name: 'storage-${env}'
  params: {
    env: env
    location: location
    tags: tags
  }
}

module appInsights 'modules/appinsights.bicep' = {
  scope: rg
  name: 'appi-${env}'
  params: {
    env: env
    location: location
    tags: tags
    retentionInDays: appInsightsRetentionDays
  }
}

module appService 'modules/appservice.bicep' = {
  scope: rg
  name: 'app-${env}'
  params: {
    env: env
    location: location
    tags: tags
    planSku: appServicePlanSku
    keyVaultName: keyVault.outputs.keyVaultName
    appInsightsConnectionString: appInsights.outputs.appInsightsConnectionString
    appsSubnetId: network.outputs.appsSubnetId
  }
}

module staticWebApps 'modules/staticwebapps.bicep' = {
  scope: rg
  name: 'swa-${env}'
  params: {
    env: env
    location: staticWebAppsLocation
    tags: tags
  }
}

module containerApps 'modules/containerapps.bicep' = {
  scope: rg
  name: 'ca-${env}'
  params: {
    env: env
    location: location
    tags: tags
    containersSubnetId: network.outputs.containersSubnetId
    logAnalyticsWorkspaceId: appInsights.outputs.logAnalyticsWorkspaceId
    cpu: containerAppsConfig.cpu
    memory: containerAppsConfig.memory
    minReplicas: containerAppsConfig.minReplicas
    maxReplicas: containerAppsConfig.maxReplicas
  }
}

module apiKvAccess 'modules/kvRoleAssignment.bicep' = {
  scope: rg
  name: 'kv-rbac-api-${env}'
  params: {
    keyVaultName: keyVault.outputs.keyVaultName
    principalId: appService.outputs.apiManagedIdentityPrincipalId
  }
}

module calcKvAccess 'modules/kvRoleAssignment.bicep' = {
  scope: rg
  name: 'kv-rbac-calc-${env}'
  params: {
    keyVaultName: keyVault.outputs.keyVaultName
    principalId: containerApps.outputs.calcManagedIdentityPrincipalId
  }
}

output resourceGroupName string = rg.name
output keyVaultUri string = keyVault.outputs.keyVaultUri
output keyVaultName string = keyVault.outputs.keyVaultName
output sqlServerFqdn string = sql.outputs.sqlServerFqdn
output sqlDatabaseName string = sql.outputs.sqlDatabaseName
output redisHostname string = redis.outputs.redisHostname
output storageAccountName string = storage.outputs.storageAccountName
output apiHostname string = appService.outputs.apiAppServiceDefaultHostname
output auditAppHostname string = staticWebApps.outputs.auditAppHostname
output adminAppHostname string = staticWebApps.outputs.adminAppHostname
output clientPortalHostname string = staticWebApps.outputs.clientPortalHostname
output calcServiceFqdn string = containerApps.outputs.calcServiceFqdn
output appInsightsConnectionString string = appInsights.outputs.appInsightsConnectionString
