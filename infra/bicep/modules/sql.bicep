// sql.bicep — Azure SQL Database (S2 default, overridable)

@description('Environment name (dev | staging | prod)')
@allowed(['dev', 'staging', 'prod'])
param env string

@description('Azure region')
param location string

@description('Resource tags')
param tags object

@description('SQL Database SKU name (S2 default; overridable to S4/P1 for prod upgrade path)')
param sqlSkuName string = 'S2'

@description('SQL Database tier')
param sqlTier string = 'Standard'

@description('SQL admin login name')
param adminLogin string = 'cemsadmin'

@description('SQL admin password — fetched from Key Vault via existing secret reference in main.bicep')
@secure()
param adminPassword string

@description('Whether to enable Advanced Data Security / threat detection (staging + prod only)')
param enableThreatDetection bool = false

@description('Optional firewall IP ranges for dev convenience (empty array in staging/prod)')
param allowedIpRanges array = []

var sqlServerName = 'cems-${env}-sql-${uniqueString(resourceGroup().id, 'cems', env)}'
var sqlDatabaseName = 'cems'

resource sqlServer 'Microsoft.Sql/servers@2024-05-01-preview' = {
  name: sqlServerName
  location: location
  tags: tags
  properties: {
    administratorLogin: adminLogin
    administratorLoginPassword: adminPassword
    version: '12.0'
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
  }
}

resource sqlDatabase 'Microsoft.Sql/servers/databases@2024-05-01-preview' = {
  parent: sqlServer
  name: sqlDatabaseName
  location: location
  tags: tags
  sku: {
    name: sqlSkuName
    tier: sqlTier
  }
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
    zoneRedundant: false
  }
}

resource allowAzureServices 'Microsoft.Sql/servers/firewallRules@2024-05-01-preview' = {
  parent: sqlServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource devIpAllowlist 'Microsoft.Sql/servers/firewallRules@2024-05-01-preview' = [for (ipRange, i) in allowedIpRanges: {
  parent: sqlServer
  name: 'AllowDev-${i}'
  properties: {
    startIpAddress: ipRange.start
    endIpAddress: ipRange.end
  }
}]

resource threatDetection 'Microsoft.Sql/servers/securityAlertPolicies@2024-05-01-preview' = if (enableThreatDetection) {
  parent: sqlServer
  name: 'Default'
  properties: {
    state: 'Enabled'
    emailAccountAdmins: true
    retentionDays: 30
  }
}

output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
output sqlServerName string = sqlServer.name
output sqlDatabaseName string = sqlDatabase.name
