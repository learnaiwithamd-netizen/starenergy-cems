// network.bicep — VNet and subnets baseline
// Address spaces are per-env and non-overlapping so peering between envs (shared bastion,
// shared monitoring, ExpressRoute hub) works without AddressSpacesOverlap errors.

@description('Environment name (dev | staging | prod)')
@allowed(['dev', 'staging', 'prod'])
param env string

@description('Azure region')
param location string

@description('Resource tags')
param tags object

@description('VNet address space (/16) — must be non-overlapping across dev/staging/prod for peering')
param vnetAddressPrefix string

@description('Apps subnet prefix (/24 within vnetAddressPrefix, expected: <vnet octet>.<env>.1.0/24)')
param appsSubnetPrefix string

@description('Containers subnet prefix (/23 within vnetAddressPrefix)')
param containersSubnetPrefix string

@description('Data subnet prefix (/24 within vnetAddressPrefix) — reserved for private endpoints in staging/prod')
param dataSubnetPrefix string

var vnetName = 'cems-${env}-vnet'

resource vnet 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: vnetName
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [vnetAddressPrefix]
    }
    subnets: [
      {
        name: 'apps-subnet'
        properties: {
          addressPrefix: appsSubnetPrefix
          delegations: [
            {
              name: 'appServiceDelegation'
              properties: {
                serviceName: 'Microsoft.Web/serverFarms'
              }
            }
          ]
          privateEndpointNetworkPolicies: 'Disabled'
          privateLinkServiceNetworkPolicies: 'Enabled'
        }
      }
      {
        name: 'containers-subnet'
        properties: {
          addressPrefix: containersSubnetPrefix
          delegations: [
            {
              name: 'containerAppsDelegation'
              properties: {
                serviceName: 'Microsoft.App/environments'
              }
            }
          ]
          privateEndpointNetworkPolicies: 'Disabled'
          privateLinkServiceNetworkPolicies: 'Enabled'
        }
      }
      {
        name: 'data-subnet'
        properties: {
          addressPrefix: dataSubnetPrefix
          privateEndpointNetworkPolicies: 'Disabled'
          privateLinkServiceNetworkPolicies: 'Enabled'
        }
      }
    ]
  }
}

output vnetId string = vnet.id
output vnetName string = vnet.name
output appsSubnetId string = '${vnet.id}/subnets/apps-subnet'
output containersSubnetId string = '${vnet.id}/subnets/containers-subnet'
output dataSubnetId string = '${vnet.id}/subnets/data-subnet'
