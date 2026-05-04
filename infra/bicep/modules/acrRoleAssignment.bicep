// acrRoleAssignment.bicep — grants an ACR role to a managed identity.
// Defaults to AcrPull (7f951dda-...); pass `roleDefinitionId` to override
// (e.g. AcrPush 8311e382-... for CI image pushes).

@description('ACR name')
param acrName string

@description('Principal id of the managed identity to grant access')
param principalId string

@description('Principal type')
@allowed(['ServicePrincipal', 'User', 'Group'])
param principalType string = 'ServicePrincipal'

@description('Role definition GUID (defaults to AcrPull)')
param roleDefinitionId string = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

@description('Role name disambiguator used to derive the role-assignment guid (must differ across role types for the same principal)')
param roleName string = 'acr-pull'

resource acr 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' existing = {
  name: acrName
}

resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: acr
  name: guid(acr.id, principalId, roleName)
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      roleDefinitionId
    )
    principalId: principalId
    principalType: principalType
  }
}
