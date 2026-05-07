// containerapps.bicep — Container Apps managed environment + calc-service Container App
// Internal ingress only (no public URL); VNet-integrated so API can reach via http://cems-{env}-calc.internal

@description('Environment name (dev | staging | prod)')
@allowed(['dev', 'staging', 'prod'])
param env string

@description('Azure region')
param location string

@description('Resource tags')
param tags object

@description('Subnet id for Container Apps environment (only used when creating a new environment)')
param containersSubnetId string = ''

@description('Log Analytics workspace id for diagnostics (only used when creating a new environment)')
param logAnalyticsWorkspaceId string = ''

@description('Resource id of an existing Container Apps environment to reuse. When set, no new environment is created.')
param existingCaeResourceId string = ''

@description('ACR login server (e.g. cemsacrdev.azurecr.io) — set by main.bicep from acr.bicep output')
param acrLoginServer string

@description('Image tag to pull from ACR (overridden by CI in Story 0.6)')
param imageTag string = 'latest'

@description('Override container image. Defaults to {acrLoginServer}/calc-service:{imageTag}.')
param image string = '${acrLoginServer}/calc-service:${imageTag}'

@description('CPU cores')
param cpu string = '0.25'

@description('Memory')
param memory string = '0.5Gi'

@description('Minimum replica count')
@minValue(0)
@maxValue(25)
param minReplicas int = 0

@description('Maximum replica count')
@minValue(1)
@maxValue(25)
param maxReplicas int = 1

var caeName = 'cems-${env}-cae'
var calcAppName = 'cems-${env}-calc'
var createNewEnv = empty(existingCaeResourceId)

resource logWorkspace 'Microsoft.OperationalInsights/workspaces@2025-02-01' existing = if (createNewEnv) {
  name: createNewEnv ? last(split(logAnalyticsWorkspaceId, '/')) : 'placeholder'
}

resource cae 'Microsoft.App/managedEnvironments@2025-01-01' = if (createNewEnv) {
  name: caeName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: createNewEnv ? logWorkspace.properties.customerId : ''
        sharedKey: createNewEnv ? logWorkspace.listKeys().primarySharedKey : ''
      }
    }
    vnetConfiguration: {
      infrastructureSubnetId: containersSubnetId
      internal: true
    }
    zoneRedundant: false
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
}

var resolvedCaeId = createNewEnv ? cae.id : existingCaeResourceId

resource calcApp 'Microsoft.App/containerApps@2025-01-01' = {
  name: calcAppName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: resolvedCaeId
    workloadProfileName: 'Consumption'
    configuration: {
      ingress: {
        external: false
        targetPort: 8000
        transport: 'http'
        allowInsecure: false
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
      }
      registries: [
        {
          server: acrLoginServer
          identity: 'system'
        }
      ]
      activeRevisionsMode: 'Single'
    }
    template: {
      containers: [
        {
          name: 'calc-service'
          image: image
          resources: {
            cpu: json(cpu)
            memory: memory
          }
          env: [
            {
              name: 'CEMS_ENV'
              value: env
            }
            {
              name: 'LOG_LEVEL'
              value: 'INFO'
            }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: 8000
              }
              initialDelaySeconds: 5
              periodSeconds: 30
            }
          ]
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
      }
    }
  }
}

output calcServiceFqdn string = calcApp.properties.configuration.ingress.fqdn
output calcManagedIdentityPrincipalId string = calcApp.identity.principalId
output calcAppName string = calcApp.name
output caeName string = createNewEnv ? cae.name : last(split(existingCaeResourceId, '/'))
