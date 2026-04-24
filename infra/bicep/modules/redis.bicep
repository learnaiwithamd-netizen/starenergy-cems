// redis.bicep — Azure Cache for Redis (Basic C0 dev, Standard C1 staging/prod)

@description('Environment name (dev | staging | prod)')
@allowed(['dev', 'staging', 'prod'])
param env string

@description('Azure region')
param location string

@description('Resource tags')
param tags object

@description('Redis SKU: { name, family, capacity }')
param sku object = {
  name: 'Basic'
  family: 'C'
  capacity: 0
}

var redisName = 'cems-${env}-redis-${uniqueString(resourceGroup().id, 'cems', env)}'

resource redis 'Microsoft.Cache/redis@2024-11-01' = {
  name: redisName
  location: location
  tags: tags
  properties: {
    sku: sku
    enableNonSslPort: false
    minimumTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
    redisConfiguration: {
      'maxmemory-policy': 'allkeys-lru'
    }
  }
}

output redisHostname string = redis.properties.hostName
output redisPort int = redis.properties.sslPort
output redisName string = redis.name
output redisId string = redis.id

// BullMQ-compatible connection string (rediss:// with TLS). Written to Key Vault in main.bicep.
@secure()
output connectionString string = 'rediss://:${redis.listKeys().primaryKey}@${redis.properties.hostName}:${redis.properties.sslPort}'
