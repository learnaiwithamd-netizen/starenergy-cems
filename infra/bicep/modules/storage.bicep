// storage.bicep — Blob Storage for audit photos + PDF reports
// All containers private (publicAccess: None); access via server-issued SAS tokens
// State-gating (IN_REVIEW lock, APPROVED immutability) enforced in API service code, not at storage layer

@description('Environment name (dev | staging | prod)')
@allowed(['dev', 'staging', 'prod'])
param env string

@description('Azure region')
param location string

@description('Resource tags')
param tags object

@description('Storage account SKU')
param skuName string = 'Standard_LRS'

@description('Access tier')
param accessTier string = 'Hot'

@description('CORS allowed origins. Defaults to empty — Story 0.6 (CI/CD) populates with specific SWA hostnames once they are known. Never leave as *.azurestaticapps.net (any Azure tenant).')
param corsAllowedOrigins array = []

@description('Network default action — Deny in staging/prod, Allow in dev')
@allowed(['Allow', 'Deny'])
param networkDefaultAction string = (env == 'dev') ? 'Allow' : 'Deny'

// Storage account names: 3-24 chars, lowercase alphanumeric, globally unique
// cems (4) + env (max 7 'staging') + st (2) + 9-char hash = 22 chars
var storageName = toLower('cems${env}st${substring(uniqueString(resourceGroup().id, 'cems', env), 0, 9)}')

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  tags: tags
  sku: {
    name: skuName
  }
  kind: 'StorageV2'
  properties: {
    accessTier: accessTier
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: networkDefaultAction
      bypass: 'AzureServices'
    }
    encryption: {
      services: {
        blob: {
          enabled: true
          keyType: 'Account'
        }
      }
      keySource: 'Microsoft.Storage'
    }
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
  properties: {
    cors: {
      corsRules: empty(corsAllowedOrigins) ? [] : [
        {
          allowedOrigins: corsAllowedOrigins
          allowedMethods: ['GET', 'HEAD', 'PUT', 'POST']
          allowedHeaders: ['x-ms-blob-type', 'x-ms-blob-content-type', 'content-type', 'authorization']
          exposedHeaders: ['etag']
          maxAgeInSeconds: 3600
        }
      ]
    }
    deleteRetentionPolicy: {
      enabled: true
      days: 7
    }
  }
}

resource photosContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'audit-photos'
  properties: {
    publicAccess: 'None'
  }
}

resource reportsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'audit-reports'
  properties: {
    publicAccess: 'None'
  }
}

output storageAccountName string = storage.name
output storageAccountId string = storage.id
output storageAccountBlobEndpoint string = storage.properties.primaryEndpoints.blob
output photosContainerName string = photosContainer.name
output reportsContainerName string = reportsContainer.name

// Connection string for writing to Key Vault in main.bicep.
// Uses listKeys() at template-expansion time.
@secure()
output connectionString string = 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
