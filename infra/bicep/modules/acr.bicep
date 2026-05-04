// acr.bicep — Azure Container Registry for the calc-service container image
// Pulled by Container Apps via the calc app's system-assigned managed identity (AcrPull role).

@description('Environment name (dev | staging | prod)')
@allowed(['dev', 'staging', 'prod'])
param env string

@description('Azure region')
param location string

@description('Resource tags')
param tags object

@description('SKU — Basic for dev, Standard for staging+prod')
@allowed(['Basic', 'Standard', 'Premium'])
param sku string = 'Basic'

var acrName = 'cemsacr${env}'

resource acr 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' = {
  name: acrName
  location: location
  tags: tags
  sku: {
    name: sku
  }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Enabled'
    zoneRedundancy: 'Disabled'
  }
}

output acrLoginServer string = acr.properties.loginServer
output acrName string = acr.name
output acrId string = acr.id
