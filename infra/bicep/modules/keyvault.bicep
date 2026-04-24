// keyvault.bicep — Azure Key Vault with RBAC authorisation and seeded secret placeholders
// Architecture mandate: enableRbacAuthorization: true (not access policies)

@description('Environment name (dev | staging | prod)')
@allowed(['dev', 'staging', 'prod'])
param env string

@description('Azure region')
param location string

@description('Resource tags')
param tags object

@description('Azure tenant id')
param tenantId string

@description('Whether to enable purge protection (staging/prod only)')
param enablePurgeProtection bool = false

@description('Soft delete retention in days')
@minValue(7)
@maxValue(90)
param softDeleteRetentionInDays int = 30

var kvName = 'cems-${env}-kv-${uniqueString(resourceGroup().id, 'cems', env)}'
var seedSecrets = [
  'database-url'
  'jwt-secret'
  'jwt-refresh-secret'
  'azure-storage-connection-string'
  'redis-url'
  'resend-api-key'
  'claude-api-key'
  'appinsights-connection-string'
  'sql-admin-password'
]

resource keyVault 'Microsoft.KeyVault/vaults@2024-04-01-preview' = {
  name: kvName
  location: location
  tags: tags
  properties: {
    tenantId: tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: softDeleteRetentionInDays
    enablePurgeProtection: enablePurgeProtection ? true : null
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
}

resource placeholderSecrets 'Microsoft.KeyVault/vaults/secrets@2024-04-01-preview' = [for secretName in seedSecrets: {
  parent: keyVault
  name: secretName
  properties: {
    value: 'REPLACE_ME_${secretName}'
    contentType: 'text/plain'
    attributes: {
      enabled: true
    }
  }
}]

output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
output keyVaultId string = keyVault.id
