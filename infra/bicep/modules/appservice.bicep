// appservice.bicep — App Service Plan + Linux Node.js 22 App Service for the API
// Managed identity enabled; Key Vault references used for all secret app settings
// Prod gets a staging slot for zero-downtime slot swap (inherits identical appSettings)

@description('Environment name (dev | staging | prod)')
@allowed(['dev', 'staging', 'prod'])
param env string

@description('Azure region')
param location string

@description('Resource tags')
param tags object

@description('App Service Plan SKU (B2 dev/staging, B3 prod, P1v3/P1v2 optional for prod upgrade)')
param planSku string = 'B2'

@description('Key Vault name for secret references')
param keyVaultName string

@description('Subnet id for VNet integration (apps-subnet)')
param appsSubnetId string

// Map SKU name → tier. Covers Basic / Standard / PremiumV2 / PremiumV3.
// Unknown prefix defaults to Standard (safer than Basic).
var skuTierMap = {
  B: 'Basic'
  S: 'Standard'
  P: startsWith(planSku, 'P1v3') || startsWith(planSku, 'P2v3') || startsWith(planSku, 'P3v3') ? 'PremiumV3' : 'PremiumV2'
  I: 'Isolated'
}
var skuPrefix = substring(planSku, 0, 1)
var planTier = skuTierMap[?skuPrefix] ?? 'Standard'

var planName = 'cems-${env}-asp'
var apiAppName = 'cems-${env}-api'
var kvRef = 'https://${keyVaultName}${az.environment().suffixes.keyvaultDns}/secrets'

// Shared app settings array — used by both main site and prod staging slot so a swap serves
// a fully-configured instance.
var sharedAppSettings = [
  {
    name: 'NODE_ENV'
    value: env == 'prod' ? 'production' : env
  }
  {
    name: 'PORT'
    value: '8080'
  }
  {
    name: 'WEBSITES_PORT'
    value: '8080'
  }
  {
    name: 'WEBSITE_NODE_DEFAULT_VERSION'
    value: '~22'
  }
  {
    name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
    value: '@Microsoft.KeyVault(SecretUri=${kvRef}/appinsights-connection-string)'
  }
  {
    name: 'DATABASE_URL'
    value: '@Microsoft.KeyVault(SecretUri=${kvRef}/database-url)'
  }
  {
    name: 'JWT_SECRET'
    value: '@Microsoft.KeyVault(SecretUri=${kvRef}/jwt-secret)'
  }
  {
    name: 'JWT_REFRESH_SECRET'
    value: '@Microsoft.KeyVault(SecretUri=${kvRef}/jwt-refresh-secret)'
  }
  {
    name: 'AZURE_STORAGE_CONNECTION_STRING'
    value: '@Microsoft.KeyVault(SecretUri=${kvRef}/azure-storage-connection-string)'
  }
  {
    name: 'REDIS_URL'
    value: '@Microsoft.KeyVault(SecretUri=${kvRef}/redis-url)'
  }
  {
    name: 'RESEND_API_KEY'
    value: '@Microsoft.KeyVault(SecretUri=${kvRef}/resend-api-key)'
  }
  {
    name: 'CLAUDE_API_KEY'
    value: '@Microsoft.KeyVault(SecretUri=${kvRef}/claude-api-key)'
  }
]

var sharedSiteConfig = {
  linuxFxVersion: 'NODE|22-lts'
  minTlsVersion: '1.2'
  ftpsState: 'Disabled'
  alwaysOn: env != 'dev'
  http20Enabled: true
  healthCheckPath: '/api/v1/health'
  appSettings: sharedAppSettings
}

resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: planName
  location: location
  tags: tags
  sku: {
    name: planSku
    tier: planTier
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

resource apiApp 'Microsoft.Web/sites@2024-04-01' = {
  name: apiAppName
  location: location
  tags: tags
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    virtualNetworkSubnetId: appsSubnetId
    vnetRouteAllEnabled: true
    siteConfig: sharedSiteConfig
  }
}

// Prod staging slot inherits identical siteConfig so a swap immediately serves a functional instance.
resource prodStagingSlot 'Microsoft.Web/sites/slots@2024-04-01' = if (env == 'prod') {
  parent: apiApp
  name: 'staging'
  location: location
  tags: tags
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    virtualNetworkSubnetId: appsSubnetId
    vnetRouteAllEnabled: true
    siteConfig: sharedSiteConfig
  }
}

output apiAppServiceName string = apiApp.name
output apiAppServiceDefaultHostname string = apiApp.properties.defaultHostName
output apiManagedIdentityPrincipalId string = apiApp.identity.principalId
output slotManagedIdentityPrincipalId string = env == 'prod' ? prodStagingSlot!.identity.principalId : ''
output planId string = plan.id
