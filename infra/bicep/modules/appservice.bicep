// appservice.bicep — App Service Plan + Linux Node.js 22 App Service for the API
// Managed identity enabled; Key Vault references used for all secret app settings
// Prod gets a staging slot for zero-downtime slot swap

@description('Environment name (dev | staging | prod)')
@allowed(['dev', 'staging', 'prod'])
param env string

@description('Azure region')
param location string

@description('Resource tags')
param tags object

@description('App Service Plan SKU (B2 dev/staging, B3 prod)')
param planSku string = 'B2'

@description('Key Vault name for secret references')
param keyVaultName string

@description('Application Insights connection string (written to app settings via Key Vault reference by preference, but accepted direct for bootstrap)')
@secure()
param appInsightsConnectionString string

@description('Subnet id for VNet integration (apps-subnet)')
param appsSubnetId string

var planName = 'cems-${env}-asp'
var apiAppName = 'cems-${env}-api'
var kvRef = 'https://${keyVaultName}${az.environment().suffixes.keyvaultDns}/secrets'

resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: planName
  location: location
  tags: tags
  sku: {
    name: planSku
    tier: startsWith(planSku, 'B') ? 'Basic' : 'Standard'
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
    siteConfig: {
      linuxFxVersion: 'NODE|22-lts'
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      alwaysOn: env != 'dev'
      http20Enabled: true
      healthCheckPath: '/api/v1/health'
      appSettings: [
        {
          name: 'NODE_ENV'
          value: env == 'prod' ? 'production' : env
        }
        {
          name: 'PORT'
          value: '8080'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~22'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
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
    }
  }
}

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
    siteConfig: {
      linuxFxVersion: 'NODE|22-lts'
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      alwaysOn: true
      http20Enabled: true
      healthCheckPath: '/api/v1/health'
    }
  }
}

output apiAppServiceName string = apiApp.name
output apiAppServiceDefaultHostname string = apiApp.properties.defaultHostName
output apiManagedIdentityPrincipalId string = apiApp.identity.principalId
output planId string = plan.id
