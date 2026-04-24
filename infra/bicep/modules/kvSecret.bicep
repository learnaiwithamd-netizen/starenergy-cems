// kvSecret.bicep — write a single secret value into an existing Key Vault
// Used by main.bicep to materialise connection strings (database-url,
// azure-storage-connection-string, redis-url, appinsights-connection-string)
// so App Service references resolve to real values on first boot.

@description('Target Key Vault name')
param keyVaultName string

@description('Secret name (kebab-case, matches App Service appSettings key after lowercasing)')
param secretName string

@description('Secret value (passed through Bicep secure handling)')
@secure()
param secretValue string

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource secret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: secretName
  properties: {
    value: secretValue
    contentType: 'text/plain'
    attributes: {
      enabled: true
    }
  }
}

output secretId string = secret.id
