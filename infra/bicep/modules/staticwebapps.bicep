// staticwebapps.bicep — three Static Web Apps (audit, admin, client-portal)
// Note: Static Web Apps has limited regional availability.
// canadacentral is NOT in the SWA supported regions list — falling back to eastus2.
// Photos/reports live in Blob Storage + SQL; SWA is pure static CDN so data residency unaffected.

@description('Environment name (dev | staging | prod)')
@allowed(['dev', 'staging', 'prod'])
param env string

@description('Static Web Apps region (eastus2 due to availability — override if needed)')
param location string = 'eastus2'

@description('Resource tags')
param tags object

var swaSku = {
  name: 'Free'
  tier: 'Free'
}

resource swaAudit 'Microsoft.Web/staticSites@2024-04-01' = {
  name: 'cems-${env}-swa-audit'
  location: location
  tags: tags
  sku: swaSku
  properties: {
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
    provider: 'None'
  }
}

resource swaAdmin 'Microsoft.Web/staticSites@2024-04-01' = {
  name: 'cems-${env}-swa-admin'
  location: location
  tags: tags
  sku: swaSku
  properties: {
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
    provider: 'None'
  }
}

resource swaClient 'Microsoft.Web/staticSites@2024-04-01' = {
  name: 'cems-${env}-swa-client'
  location: location
  tags: tags
  sku: swaSku
  properties: {
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
    provider: 'None'
  }
}

output auditAppHostname string = swaAudit.properties.defaultHostname
output adminAppHostname string = swaAdmin.properties.defaultHostname
output clientPortalHostname string = swaClient.properties.defaultHostname
output swaAuditName string = swaAudit.name
output swaAdminName string = swaAdmin.name
output swaClientName string = swaClient.name
