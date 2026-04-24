// containerapps.bicep — Container Apps managed environment + calc-service Container App
// Internal ingress only (no public URL); VNet-integrated so API can reach via http://cems-{env}-calc.internal

@description('Environment name (dev | staging | prod)')
@allowed(['dev', 'staging', 'prod'])
param env string

@description('Azure region')
param location string

@description('Resource tags')
param tags object

@description('Subnet id for Container Apps environment')
param containersSubnetId string

@description('Log Analytics workspace id for diagnostics')
param logAnalyticsWorkspaceId string

@description('Container image (placeholder until Story 0.5 ships calc-service image)')
param image string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

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

resource logWorkspace 'Microsoft.OperationalInsights/workspaces@2025-02-01' existing = {
  name: last(split(logAnalyticsWorkspaceId, '/'))
}

resource cae 'Microsoft.App/managedEnvironments@2025-01-01' = {
  name: caeName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logWorkspace.properties.customerId
        sharedKey: logWorkspace.listKeys().primarySharedKey
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

resource calcApp 'Microsoft.App/containerApps@2025-01-01' = {
  name: calcAppName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: cae.id
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
output caeName string = cae.name
