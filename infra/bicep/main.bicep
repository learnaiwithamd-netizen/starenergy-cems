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

@description('ACR SKU — Basic for dev, Standard for staging+prod')
@allowed(['Basic', 'Standard', 'Premium'])
param acrSku string = 'Basic'

@description('Calc-service image tag pulled from ACR. Overridden by CI in Story 0.6.')
param calcServiceImageTag string = 'latest'

@description('VNet /16 prefix — MUST be non-overlapping across dev/staging/prod for peering')
param vnetAddressPrefix string

@description('Apps subnet /24 prefix')
param appsSubnetPrefix string

@description('Containers subnet /23 prefix')
param containersSubnetPrefix string

@description('Data subnet /24 prefix (reserved for future private endpoints)')
param dataSubnetPrefix string

@description('Static Web Apps region (fallback eastus2 due to SWA availability)')
param staticWebAppsLocation string = 'eastus2'

@description('Static Web Apps hostnames for Storage CORS allowlist (empty on first deploy; populate after SWAs materialise)')
param swaCorsOrigins array = []

@description('Application Insights retention days')
param appInsightsRetentionDays int = 30

@description('SQL admin password — supplied via CEMS_SQL_ADMIN_PASSWORD env var by deploy.sh')
@secure()
param sqlAdminPassword string

@description('Enable "Allow Azure services" firewall rule on SQL. Dev only — disable in staging/prod.')
param enableSqlAllowAzureServices bool = false

@description('Dev-only firewall IP allowlist; empty in staging/prod')
param sqlFirewallIpRanges array = []

@description('Enable SQL threat detection (staging + prod only)')
param enableSqlThreatDetection bool = false

@description('Enable Key Vault purge protection (staging + prod only). Irreversible once true.')
param enableKeyVaultPurgeProtection bool = false

@description('Key Vault soft-delete retention days')
param keyVaultSoftDeleteRetentionDays int = 30

@description('Additional resource tags on top of the defaults')
param extraTags object = {}

@description('GitHub organisation / user that owns the source repo — used to scope OIDC federated credentials')
param githubOrg string = 'star-energy'

@description('GitHub repo name — used to scope OIDC federated credentials')
param githubRepo string = 'cems'

@description('Provision the GitHub OIDC federated identity. Set to false for the very first deploy (chicken-and-egg).')
param enableGithubFederation bool = true

@description('Resource id of an existing Container Apps Environment to reuse (avoids the 1-per-region quota limit). Leave empty to create a new one.')
param existingCaeResourceId string = ''

@description('Override the calc-service container image entirely (e.g. a public placeholder for initial infra bootstrap). Leave empty to use ACR image.')
param calcServiceImageOverride string = ''

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
    vnetAddressPrefix: vnetAddressPrefix
    appsSubnetPrefix: appsSubnetPrefix
    containersSubnetPrefix: containersSubnetPrefix
    dataSubnetPrefix: dataSubnetPrefix
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
    allowAzureServicesFirewall: enableSqlAllowAzureServices
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
    corsAllowedOrigins: swaCorsOrigins
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

// ─── Secret population: write real connection strings into Key Vault ──────
// These MUST complete before App Service tries to resolve its Key Vault references.

module databaseUrlSecret 'modules/kvSecret.bicep' = {
  scope: rg
  name: 'secret-database-url-${env}'
  params: {
    keyVaultName: keyVault.outputs.keyVaultName
    secretName: 'database-url'
    secretValue: 'sqlserver://${sql.outputs.sqlServerFqdn}:1433;database=${sql.outputs.sqlDatabaseName};user=${sql.outputs.sqlAdminLogin};password=${sqlAdminPassword};encrypt=true;trustServerCertificate=false'
  }
}

module storageConnSecret 'modules/kvSecret.bicep' = {
  scope: rg
  name: 'secret-storage-conn-${env}'
  params: {
    keyVaultName: keyVault.outputs.keyVaultName
    secretName: 'azure-storage-connection-string'
    secretValue: storage.outputs.connectionString
  }
}

module redisUrlSecret 'modules/kvSecret.bicep' = {
  scope: rg
  name: 'secret-redis-url-${env}'
  params: {
    keyVaultName: keyVault.outputs.keyVaultName
    secretName: 'redis-url'
    secretValue: redis.outputs.connectionString
  }
}

module appInsightsConnSecret 'modules/kvSecret.bicep' = {
  scope: rg
  name: 'secret-appi-conn-${env}'
  params: {
    keyVaultName: keyVault.outputs.keyVaultName
    secretName: 'appinsights-connection-string'
    secretValue: appInsights.outputs.appInsightsConnectionString
  }
}

// ─── Compute layer ────────────────────────────────────────────────────────

module appService 'modules/appservice.bicep' = {
  scope: rg
  name: 'app-${env}'
  params: {
    env: env
    location: location
    tags: tags
    planSku: appServicePlanSku
    keyVaultName: keyVault.outputs.keyVaultName
    appsSubnetId: network.outputs.appsSubnetId
    calcServiceFqdn: containerApps.outputs.calcServiceFqdn
  }
  dependsOn: [
    databaseUrlSecret
    storageConnSecret
    redisUrlSecret
    appInsightsConnSecret
  ]
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

module acr 'modules/acr.bicep' = {
  scope: rg
  name: 'acr-${env}'
  params: {
    env: env
    location: location
    tags: tags
    sku: acrSku
  }
}

module containerApps 'modules/containerapps.bicep' = {
  scope: rg
  name: 'ca-${env}'
  params: {
    env: env
    location: location
    tags: tags
    containersSubnetId: empty(existingCaeResourceId) ? network.outputs.containersSubnetId : ''
    logAnalyticsWorkspaceId: empty(existingCaeResourceId) ? appInsights.outputs.logAnalyticsWorkspaceId : ''
    existingCaeResourceId: existingCaeResourceId
    acrLoginServer: acr.outputs.acrLoginServer
    imageTag: calcServiceImageTag
    image: empty(calcServiceImageOverride) ? '${acr.outputs.acrLoginServer}/calc-service:${calcServiceImageTag}' : calcServiceImageOverride
    cpu: containerAppsConfig.cpu
    memory: containerAppsConfig.memory
    minReplicas: containerAppsConfig.minReplicas
    maxReplicas: containerAppsConfig.maxReplicas
  }
}

module calcAcrAccess 'modules/acrRoleAssignment.bicep' = {
  scope: rg
  name: 'acr-rbac-calc-${env}'
  params: {
    acrName: acr.outputs.acrName
    principalId: containerApps.outputs.calcManagedIdentityPrincipalId
  }
}

// ─── GitHub OIDC federated identity ────────────────────────────────────
// Trust GitHub Actions workflows to mint short-lived tokens scoped by
// claim (env, branch, PR). NO client secrets in the repo.
module githubFederatedIdentity 'modules/githubFederatedIdentity.bicep' = if (enableGithubFederation) {
  scope: rg
  name: 'gh-fed-${env}'
  params: {
    env: env
    location: location
    tags: tags
    githubOrg: githubOrg
    githubRepo: githubRepo
    // PR-triggered builds only push to the dev environment (preview SWAs).
    // Staging/prod federated subjects must NEVER trust pull-request claims.
    trustPullRequests: env == 'dev'
  }
}

// Grant the GH MI AcrPush on the env's ACR so deploy workflows can push images.
module githubAcrAccess 'modules/acrRoleAssignment.bicep' = if (enableGithubFederation) {
  scope: rg
  name: 'acr-rbac-gh-${env}'
  params: {
    acrName: acr.outputs.acrName
    principalId: githubFederatedIdentity!.outputs.managedIdentityPrincipalId
    // The shared module grants AcrPull by default; we want AcrPush for the
    // GH identity so it can publish images. Pass an explicit role override.
    roleDefinitionId: '8311e382-0749-4cb8-b61a-304f252e45ec' // AcrPush
    roleName: 'acr-push'
  }
}

// Grant the GH MI Key Vault Secrets User so the migrate job can read DATABASE_URL.
module githubKvAccess 'modules/kvRoleAssignment.bicep' = if (enableGithubFederation) {
  scope: rg
  name: 'kv-rbac-gh-${env}'
  params: {
    keyVaultName: keyVault.outputs.keyVaultName
    principalId: githubFederatedIdentity!.outputs.managedIdentityPrincipalId
  }
}

// ─── RBAC: grant managed identities Key Vault Secrets User ────────────────
// RBAC propagation is eventually consistent (30-120s). deploy.sh restarts
// App Service after deployment so it re-resolves Key Vault references once
// propagation completes.

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
output apiAppServiceName string = appService.outputs.apiAppServiceName
output auditAppHostname string = staticWebApps.outputs.auditAppHostname
output adminAppHostname string = staticWebApps.outputs.adminAppHostname
output clientPortalHostname string = staticWebApps.outputs.clientPortalHostname
output calcServiceFqdn string = containerApps.outputs.calcServiceFqdn
output acrLoginServer string = acr.outputs.acrLoginServer
output acrName string = acr.outputs.acrName

// GitHub OIDC managed-identity client id — paste this into the
// AZURE_CLIENT_ID repo variable (or AZURE_CLIENT_ID_PROD for prod).
// Empty when enableGithubFederation == false (bootstrap path).
output githubManagedIdentityClientId string = enableGithubFederation
  ? githubFederatedIdentity!.outputs.managedIdentityClientId
  : ''
