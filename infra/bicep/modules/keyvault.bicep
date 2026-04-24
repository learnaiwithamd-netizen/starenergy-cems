// keyvault.bicep — Azure Key Vault with RBAC authorisation
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

@description('Whether to enable purge protection (staging/prod only). Irreversible once true — Azure does not allow turning this off.')
param enablePurgeProtection bool = false

@description('Soft delete retention in days')
@minValue(7)
@maxValue(90)
param softDeleteRetentionInDays int = 30

@description('Network default action — Deny in staging/prod, Allow in dev for developer convenience')
@allowed(['Allow', 'Deny'])
param networkDefaultAction string = (env == 'dev') ? 'Allow' : 'Deny'

// Key Vault names: 3-24 chars globally unique. Budget:
// 'cems-' (5) + env (max 7 'staging') + '-kv-' (4) + hash = 24 → hash budget 8 chars.
var kvHash = substring(uniqueString(resourceGroup().id, 'cems', env), 0, 8)
var kvName = 'cems-${env}-kv-${kvHash}'

// Secrets seeded with placeholders here are populated post-deploy by the operator
// (operator-supplied: JWT secrets, third-party API keys).
// The other four secrets — database-url, azure-storage-connection-string, redis-url,
// appinsights-connection-string — are written at deploy time from resource outputs
// in main.bicep (via dedicated Microsoft.KeyVault/vaults/secrets resources there).
var operatorSeededSecrets = [
  'jwt-secret'
  'jwt-refresh-secret'
  'resend-api-key'
  'claude-api-key'
  'sql-admin-password'
]

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
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
      defaultAction: networkDefaultAction
      bypass: 'AzureServices'
    }
  }
}

resource placeholderSecrets 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = [for secretName in operatorSeededSecrets: {
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
