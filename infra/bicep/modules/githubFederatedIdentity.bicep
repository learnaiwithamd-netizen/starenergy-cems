// githubFederatedIdentity.bicep — User-Assigned Managed Identity + GitHub OIDC
// federated credentials so GitHub Actions workflows can authenticate to Azure
// without long-lived service-principal secrets.
//
// Bootstrap caveat: the FIRST deploy of this module needs a human-or-existing-SP
// account because the workflow itself will use the MI this module creates.
// See infra/README.md for the 5-step bootstrap.

@description('Environment name (dev | staging | prod)')
@allowed(['dev', 'staging', 'prod'])
param env string

@description('Azure region')
param location string

@description('Resource tags')
param tags object

@description('GitHub organisation / user name (e.g. "star-energy")')
param githubOrg string

@description('GitHub repository name (e.g. "cems")')
param githubRepo string

@description('Trust workflows triggered by `pull_request` events. Should be true ONLY for the dev env — staging/prod must never deploy from a PR build.')
param trustPullRequests bool = false

var miName = 'cems-${env}-gh-mi'
var issuer = 'https://token.actions.githubusercontent.com'
var audiences = ['api://AzureADTokenExchange']

resource mi 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: miName
  location: location
  tags: tags
}

// Trust workflows running against the GitHub `${env}` environment (the
// most-common, env-scoped subject — pairs with `environment: ${env}` in
// the workflow yaml).
resource fedEnv 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  parent: mi
  name: 'gh-environment-${env}'
  properties: {
    issuer: issuer
    subject: 'repo:${githubOrg}/${githubRepo}:environment:${env}'
    audiences: audiences
  }
}

// Trust workflows running against the `main` branch (staging deploy on push
// to main). Unrestricted by environment — the deploy-staging.yml workflow
// runs on push without `environment: staging` (the env gate is only for prod).
//
// Federated credentials must be written serially per managed identity; Azure
// rejects parallel writes with `ConcurrentFederatedIdentityCredentialsWritesForSingleManagedIdentity`.
// Each subsequent cred declares dependsOn on the previous one to enforce ordering.
resource fedMain 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = if (env == 'staging') {
  parent: mi
  name: 'gh-ref-main'
  dependsOn: [fedEnv]
  properties: {
    issuer: issuer
    subject: 'repo:${githubOrg}/${githubRepo}:ref:refs/heads/main'
    audiences: audiences
  }
}

// Trust PR-triggered workflows ONLY for dev (preview-deploy SWAs). Never
// add this to staging/prod.
resource fedPullRequest 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = if (trustPullRequests) {
  parent: mi
  name: 'gh-pull-request'
  // Serialise after fedEnv (always present) AND fedMain (staging only).
  dependsOn: [fedEnv, fedMain]
  properties: {
    issuer: issuer
    subject: 'repo:${githubOrg}/${githubRepo}:pull_request'
    audiences: audiences
  }
}

output managedIdentityName string = mi.name
output managedIdentityPrincipalId string = mi.properties.principalId
output managedIdentityClientId string = mi.properties.clientId
output managedIdentityResourceId string = mi.id
