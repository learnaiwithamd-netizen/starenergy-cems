// kvRoleAssignment.bicep — assigns Key Vault Secrets User role to a managed identity
// Role definition id 4633458b-17de-408a-b874-0445c86b69e6 = 'Key Vault Secrets User'

@description('Key Vault name')
param keyVaultName string

@description('Principal id of the managed identity to grant access')
param principalId string

@description('Principal type')
@allowed(['ServicePrincipal', 'User', 'Group'])
param principalType string = 'ServicePrincipal'

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: keyVault
  name: guid(keyVault.id, principalId, 'secrets-user')
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '4633458b-17de-408a-b874-0445c86b69e6'
    )
    principalId: principalId
    principalType: principalType
  }
}
