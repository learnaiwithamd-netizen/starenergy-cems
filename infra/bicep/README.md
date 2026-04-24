# CEMS Infrastructure (Bicep)

Infrastructure-as-code for the Star Energy CEMS platform on Azure. Every environment (dev / staging / prod) is provisioned from the same `main.bicep` template with environment-specific `.bicepparam` files.

## Layout

```
infra/bicep/
├── main.bicep                  # Subscription-scope root: creates RG + all resources
├── deploy.sh                   # Convenience wrapper: ./deploy.sh <env>
├── envs/
│   ├── dev/main.bicepparam     # dev parameter values (B2 App Service, C0 Redis, ...)
│   ├── staging/main.bicepparam # staging values (production-mirror SKUs, isolated data)
│   └── prod/main.bicepparam    # prod values (B3 App Service, min 1 replica, ...)
└── modules/
    ├── network.bicep           # VNet + 3 subnets (apps, containers, data)
    ├── keyvault.bicep          # Key Vault with RBAC auth; seeded secret placeholders
    ├── sql.bicep               # Azure SQL server + cems database
    ├── redis.bicep             # Azure Cache for Redis (BullMQ job queue + app cache)
    ├── storage.bicep           # Blob Storage with audit-photos + audit-reports containers
    ├── appinsights.bicep       # Log Analytics workspace + App Insights (workspace-based)
    ├── appservice.bicep        # Plan + API App Service (Linux Node 22)
    ├── staticwebapps.bicep     # 3 SWAs (audit, admin, client-portal)
    ├── containerapps.bicep     # Managed env + calc-service Container App (internal-only)
    └── kvRoleAssignment.bicep  # Helper: grants Key Vault Secrets User role to an MI
```

## Prerequisites

- **Azure CLI** 2.50+ (`brew install azure-cli`)
- **Bicep CLI** (bundled with `az bicep install` after Azure CLI install, or `brew install azure-cli`)
- Logged in: `az login`
- Correct subscription selected: `az account set --subscription <id>`
- Azure tenant id known: `az account show --query tenantId -o tsv`

## One-time setup per environment

1. Open the target `envs/<env>/main.bicepparam` and set `tenantId` to your tenant value (currently a placeholder `00000000-...`).
2. Export a strong SQL admin password for this deploy:
   ```bash
   export CEMS_SQL_ADMIN_PASSWORD="$(openssl rand -base64 32)"
   ```
   (The password is seeded into the SQL server and must be rotated via `az sql server update` after the first deploy.)

## Deploy

```bash
# Lint/build first (no cloud calls)
az bicep build --file main.bicep

# Dry-run against Azure (requires az login)
az deployment sub what-if \
  --location canadacentral \
  --template-file main.bicep \
  --parameters envs/dev/main.bicepparam \
  --parameters sqlAdminPassword="$CEMS_SQL_ADMIN_PASSWORD"

# Deploy via wrapper script (does what-if + prompts for confirmation)
./deploy.sh dev
```

For `prod`, the wrapper requires typing `DEPLOY PROD` and then the subscription id to proceed.

## Post-deploy: populate Key Vault secrets

The Bicep template seeds Key Vault with placeholder values (`REPLACE_ME_<secret-name>`). After the first deploy, grant yourself `Key Vault Secrets Officer` and set real values:

```bash
KV=$(az deployment sub show -n <deployment-name> --query properties.outputs.keyVaultName.value -o tsv)
ME=$(az account show --query user.name -o tsv)
az role assignment create --role "Key Vault Secrets Officer" --assignee "$ME" --scope "$(az keyvault show -n $KV --query id -o tsv)"

az keyvault secret set --vault-name "$KV" --name database-url --value "sqlserver://..."
az keyvault secret set --vault-name "$KV" --name jwt-secret --value "$(openssl rand -base64 64)"
az keyvault secret set --vault-name "$KV" --name jwt-refresh-secret --value "$(openssl rand -base64 64)"
az keyvault secret set --vault-name "$KV" --name azure-storage-connection-string --value "DefaultEndpointsProtocol=https;..."
az keyvault secret set --vault-name "$KV" --name redis-url --value "rediss://..."
az keyvault secret set --vault-name "$KV" --name resend-api-key --value "re_..."
az keyvault secret set --vault-name "$KV" --name claude-api-key --value "sk-ant-..."
```

App Service picks up the Key Vault references automatically on the next restart.

## Naming convention

Pattern: `cems-{env}-{service}[-{uniqueHash}]`

- Resource group: `cems-{env}-rg`
- SQL server: `cems-{env}-sql-{hash}` (globally unique)
- Redis: `cems-{env}-redis-{hash}`
- Storage: `cems{env}st{hash}` (no hyphens allowed, 24 chars max, globally unique)
- Key Vault: `cems-{env}-kv-{hash}` (24 chars max)
- App Service plan: `cems-{env}-asp`
- API App Service: `cems-{env}-api`
- Container Apps env: `cems-{env}-cae`
- Container App (calc): `cems-{env}-calc`
- Static Web Apps: `cems-{env}-swa-{audit|admin|client}`
- VNet: `cems-{env}-vnet`
- App Insights: `cems-{env}-appi`
- Log Analytics: `cems-{env}-log`

`{hash}` is deterministic via `uniqueString(resourceGroup().id, 'cems', env)` — stable across redeploys of the same RG.

## Region

**`canadacentral`** only for compute + data. Static Web Apps has limited regional availability; we use `eastus2` for SWA resources (they're pure static CDN so user data is unaffected).

## Teardown

```bash
az group delete --name cems-dev-rg --yes --no-wait
```

Beware: in staging + prod, Key Vault has purge protection enabled — you cannot fully delete it for `softDeleteRetentionInDays` (30 days) without operator intervention.

## Validated in CI

- `az bicep build main.bicep` — zero errors or warnings
- Every module under `modules/` — zero errors or warnings

Actual `az deployment sub create` runs out-of-band (this story's scope covers IaC authorship + build verification only; Story 0.6 wires GitHub Actions for automated staging deploys).
