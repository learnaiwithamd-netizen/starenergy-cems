# Story 0.2: Azure Infrastructure Provisioning

Status: ready-for-dev

## Story

As a DevOps engineer,
I want all Azure services provisioned in Canada Central across dev/staging/prod environments,
So that applications have a deployment target with correct data residency, security isolation, and environment parity.

## Acceptance Criteria

1. **Given** Azure subscription is configured, **When** infrastructure-as-code (Bicep) is applied, **Then** Azure SQL (S2, 50 DTU), Azure Cache for Redis (C0 dev / C1 staging + prod), Azure Blob Storage (LRS), Azure Key Vault (Standard), Azure App Service (B2 dev/staging, B3 prod), Azure Static Web Apps (Free), Azure Container Apps (Consumption), and Azure Application Insights are created in Canada Central (`canadacentral`).

2. **Given** dev, staging, and prod environments exist, **When** switching between them, **Then** each has fully isolated Azure SQL data, independent Redis instances, separate Key Vault instances with distinct secret values, and separate Blob Storage accounts.

3. **Given** Azure Key Vault is provisioned, **When** the application starts in any environment, **Then** all secrets (`DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `AZURE_STORAGE_CONNECTION_STRING`, `REDIS_URL`, `RESEND_API_KEY`, `CLAUDE_API_KEY`) are injected as runtime environment variables via Key Vault references — no secrets in application code, `.env` files, or deployment logs.

4. **Given** Azure Blob Storage is provisioned, **When** a test file is uploaded via the `azure-blob.ts` utility (stub added in this story), **Then** it is stored with LRS redundancy and accessible via a time-limited SAS token scoped to read-only for a fixed TTL.

5. **Given** all Bicep modules are written, **When** `az bicep build` runs against each `.bicep` file in CI, **Then** every module compiles to ARM JSON with zero errors or warnings.

## Tasks / Subtasks

- [ ] **Task 1: Establish IaC directory and naming convention** (AC: 1, 5)
  - [ ] Create `infra/bicep/` at repo root with subfolders: `modules/`, `envs/dev/`, `envs/staging/`, `envs/prod/`
  - [ ] Create `infra/bicep/README.md` with deploy instructions and convention doc
  - [ ] Resource naming convention: `cems-{env}-{service}-{suffix}` (e.g., `cems-dev-sql`, `cems-prod-kv`). Suffixes for globally-unique names use deterministic hashes of `{env, resourceGroup}`
  - [ ] Define Azure tag convention applied to every resource: `app=cems`, `env={dev|staging|prod}`, `owner=star-energy`, `costCenter=star-energy-cems`, `managedBy=bicep`

- [ ] **Task 2: Root resource group and shared parameters** (AC: 1)
  - [ ] `infra/bicep/main.bicep` — subscription-scope template that creates one resource group per environment (`cems-{env}-rg`) in `canadacentral`
  - [ ] `infra/bicep/envs/dev/main.bicepparam` — environment-specific parameter file (env name, SKUs, retention policies)
  - [ ] `infra/bicep/envs/staging/main.bicepparam` — same shape, staging values
  - [ ] `infra/bicep/envs/prod/main.bicepparam` — same shape, prod values
  - [ ] Parameter schema: `env`, `location` (pinned `canadacentral`), `sqlSku`, `redisSku`, `appServiceSku`, `tags`

- [ ] **Task 3: Azure SQL module** (AC: 1, 2)
  - [ ] `infra/bicep/modules/sql.bicep` — creates `Microsoft.Sql/servers` + `databases`
  - [ ] Parameters: `env`, `location`, `tags`, `sku` (S2 default, prod override to S4 via param), `adminLogin`, `adminPasswordSecretName`
  - [ ] Fetch SQL admin password from Key Vault reference (do NOT accept as plain-text param)
  - [ ] Output: `sqlServerFqdn`, `sqlDatabaseName`, `connectionStringSecretName`
  - [ ] Firewall: deny all public by default; `AllowAzureServices` rule on; specific IP allowlist via param (dev convenience only)
  - [ ] Enable Advanced Data Security (threat detection) in staging + prod only

- [ ] **Task 4: Azure Cache for Redis module** (AC: 1, 2)
  - [ ] `infra/bicep/modules/redis.bicep` — creates `Microsoft.Cache/Redis`
  - [ ] Parameters: `env`, `location`, `tags`, `sku` (`{ name: 'Basic', family: 'C', capacity: 0 }` for dev, `{ Standard, C, 1 }` for staging+prod)
  - [ ] `enableNonSslPort: false`, `minimumTlsVersion: '1.2'`
  - [ ] Output: `redisHostname`, `redisPort`, `primaryConnectionStringSecretName`
  - [ ] Do NOT emit the connection string in Bicep output — write directly to Key Vault

- [ ] **Task 5: Azure Blob Storage module** (AC: 1, 2, 4)
  - [ ] `infra/bicep/modules/storage.bicep` — creates `Microsoft.Storage/storageAccounts` + two containers
  - [ ] Parameters: `env`, `location`, `tags`, `skuName` ('Standard_LRS'), `kind` ('StorageV2'), `accessTier` ('Hot')
  - [ ] Containers: `audit-photos` (private), `audit-reports` (private)
  - [ ] `allowBlobPublicAccess: false`, `supportsHttpsTrafficOnly: true`, `minimumTlsVersion: 'TLS1_2'`
  - [ ] Configure blob service CORS rules for `https://*.azurestaticapps.net` (audit-app photo upload path, future)
  - [ ] Output: `storageAccountName`, `photosContainerName`, `reportsContainerName`, `connectionStringSecretName`

- [ ] **Task 6: Azure Key Vault module** (AC: 1, 3)
  - [ ] `infra/bicep/modules/keyvault.bicep` — creates `Microsoft.KeyVault/vaults`
  - [ ] Parameters: `env`, `location`, `tags`, `sku` ('standard'), `tenantId`, `accessPolicies` (array)
  - [ ] `enableRbacAuthorization: true` (not access policies) — enforce RBAC-only
  - [ ] `enableSoftDelete: true`, `softDeleteRetentionInDays: 7 (dev) / 30 (staging+prod)`
  - [ ] `enablePurgeProtection: true` for staging + prod; `false` for dev (allows cleanup during iteration)
  - [ ] Output: `keyVaultName`, `keyVaultUri`
  - [ ] Secret seed list (created with empty placeholders; operators populate real values out-of-band): `database-url`, `jwt-secret`, `jwt-refresh-secret`, `azure-storage-connection-string`, `redis-url`, `resend-api-key`, `claude-api-key`

- [ ] **Task 7: Azure App Service module** (AC: 1, 3)
  - [ ] `infra/bicep/modules/appservice.bicep` — creates `Microsoft.Web/serverfarms` (App Service Plan) + `Microsoft.Web/sites` for the Node.js API
  - [ ] Parameters: `env`, `location`, `tags`, `planSku` ('B2' dev/staging, 'B3' prod), `linuxFxVersion` ('NODE|22-lts'), `keyVaultName`
  - [ ] `httpsOnly: true`, `minTlsVersion: '1.2'`, `ftpsState: 'Disabled'`
  - [ ] System-assigned managed identity enabled; grant Key Vault Secrets User RBAC role on the kv
  - [ ] App settings use Key Vault references: `@Microsoft.KeyVault(VaultName=...;SecretName=database-url)` etc. for all 7 secrets
  - [ ] Deployment slot `staging` only on prod App Service (for zero-downtime slot swap)
  - [ ] Output: `apiAppServiceName`, `apiAppServiceDefaultHostname`, `apiManagedIdentityPrincipalId`

- [ ] **Task 8: Azure Static Web Apps module** (AC: 1)
  - [ ] `infra/bicep/modules/staticwebapps.bicep` — creates 3 `Microsoft.Web/staticSites` (audit-app, admin-app, client-portal)
  - [ ] Parameters: `env`, `location` ('canadacentral' where supported; else 'eastus2' fallback — SWA availability note)
  - [ ] SKU: `{ name: 'Free', tier: 'Free' }` (Standard post-MVP per architecture)
  - [ ] `stagingEnvironmentPolicy: 'Enabled'` — PR preview environments
  - [ ] Output: `auditAppHostname`, `adminAppHostname`, `clientPortalHostname`

- [ ] **Task 9: Azure Container Apps module (calc-service)** (AC: 1)
  - [ ] `infra/bicep/modules/containerapps.bicep` — creates `Microsoft.App/managedEnvironments` + `Microsoft.App/containerApps`
  - [ ] Parameters: `env`, `location`, `tags`, `image` (placeholder `mcr.microsoft.com/azuredocs/containerapps-helloworld:latest` until Story 0.5 ships real image), `cpu` (0.25 dev, 0.5 staging+prod), `memory` (0.5Gi dev, 1Gi staging+prod)
  - [ ] `scale.minReplicas: 0` (dev, staging), `scale.minReplicas: 1` (prod)
  - [ ] `scale.maxReplicas: 1` (dev), `3` (staging), `10` (prod)
  - [ ] Ingress: `internal` only (no public URL, per architecture: internal HTTP over VNet)
  - [ ] VNet integration: same VNet as App Service for internal calls
  - [ ] Managed identity enabled; Key Vault Secrets User RBAC
  - [ ] Output: `calcServiceFqdn` (internal only), `calcManagedIdentityPrincipalId`

- [ ] **Task 10: Application Insights module** (AC: 1)
  - [ ] `infra/bicep/modules/appinsights.bicep` — creates `Microsoft.OperationalInsights/workspaces` (Log Analytics) + `Microsoft.Insights/components` (Application Insights, workspace-based)
  - [ ] Parameters: `env`, `location`, `tags`, `retentionInDays` (30 dev, 90 staging+prod)
  - [ ] Output: `appInsightsConnectionString`, `logAnalyticsWorkspaceId`
  - [ ] The connection string is written as a Key Vault secret `appinsights-connection-string`

- [ ] **Task 11: VNet + networking baseline** (AC: 1, 2)
  - [ ] `infra/bicep/modules/network.bicep` — creates `Microsoft.Network/virtualNetworks` + subnets
  - [ ] Subnets: `apps-subnet` (App Service VNet integration), `containers-subnet` (Container Apps environment), `data-subnet` (private endpoints for SQL + Redis + Storage, staging + prod only)
  - [ ] Address space: `10.0.0.0/16` per env (non-overlapping across environments if peering is introduced later)
  - [ ] Output: `vnetId`, subnet IDs

- [ ] **Task 12: Compose root template** (AC: 1, 2)
  - [ ] `infra/bicep/main.bicep` orchestrates all 8 modules in order: network → keyVault → sql → redis → storage → appInsights → appService → staticWebApps → containerApps
  - [ ] Resource group scope deployment (sub-scope creates the RG + nested RG-scoped deployment for all modules)
  - [ ] Assigns RBAC role `Key Vault Secrets User` to App Service + Container Apps managed identities at the kv scope
  - [ ] Output key addresses (API hostname, SWA hostnames, calc-service internal FQDN, kv URI) for CI/CD consumption

- [ ] **Task 13: Deployment script + README** (AC: 1, 5)
  - [ ] `infra/bicep/deploy.sh` — convenience wrapper: `./deploy.sh <env>` runs `az deployment sub create --location canadacentral --template-file main.bicep --parameters envs/$ENV/main.bicepparam`
  - [ ] `deploy.sh` guards against accidental prod deploys (`ENV=prod` prompts confirmation twice)
  - [ ] `infra/bicep/README.md` covers: prerequisites (`az login`, subscription selection), running `az bicep build` for lint, running `az deployment sub what-if` for dry-run, running `deploy.sh`, populating Key Vault secrets post-deploy, teardown procedure

- [ ] **Task 14: azure-blob.ts utility stub in apps/api** (AC: 4)
  - [ ] Create `apps/api/src/lib/azure-blob.ts` (replaces the `.gitkeep` in `apps/api/src/lib/`)
  - [ ] Export: `getBlobServiceClient()`, `uploadBlob(container, blobName, data)`, `generateReadSasToken(container, blobName, ttlMinutes)`
  - [ ] Use `@azure/storage-blob` (already in `apps/api/package.json`)
  - [ ] Connection string read from `process.env.AZURE_STORAGE_CONNECTION_STRING` only; no hard-coded URLs
  - [ ] Default SAS TTL: 15 minutes; minimum 1, maximum 60, validated via Zod
  - [ ] Add a Vitest unit test using `testcontainers` Azurite container OR manual-run integration test (document in test file header which)

- [ ] **Task 15: Verify and test** (AC: 1–5)
  - [ ] `az bicep build infra/bicep/main.bicep` — zero errors/warnings
  - [ ] `az bicep build infra/bicep/modules/*.bicep` — zero errors/warnings each
  - [ ] `az deployment sub what-if --location canadacentral --template-file infra/bicep/main.bicep --parameters infra/bicep/envs/dev/main.bicepparam` — dry-run shows expected resources (NO actual deploy required for AC verification in this story)
  - [ ] `pnpm turbo run type-check --filter=api` — `azure-blob.ts` type-checks clean
  - [ ] `pnpm turbo run test --filter=api` — `azure-blob.test.ts` passes

## Dev Notes

### Tooling decision: Bicep over Terraform

Architecture doc leaves the choice open ("Bicep/Terraform"). Picking **Bicep** because:

- Azure-native, no state file or remote backend to manage
- `az bicep build` ships with Azure CLI (no extra toolchain installation)
- Easier incremental adoption — `main.bicep` can target subscription scope and nest RG-scoped modules
- No lock-in concern: project is Azure-only per architecture constraint

If the team later expands beyond Azure, migration to Terraform is a separate effort with its own story.

### Azure subscription + identity

Abhishek runs `az login` manually and sets the target subscription before `deploy.sh`. CI/CD (Story 0.6) uses a federated workload identity against GitHub Actions — wired later, not in this story.

### SKU pins — DO NOT upgrade without explicit instruction

| Service | Dev | Staging | Prod |
|---|---|---|---|
| Azure SQL | S2 (50 DTU) | S2 | S2 (upgrade path S4/P1) |
| Redis | Basic C0 (250MB) | Standard C1 (1GB) | Standard C1 |
| Blob Storage | Standard_LRS | Standard_LRS | Standard_LRS |
| Key Vault | Standard | Standard | Standard |
| App Service Plan | B2 | B2 | B3 |
| Static Web Apps | Free | Free | Free |
| Container Apps | Consumption (0.25 CPU / 0.5 GiB) | Consumption (0.5 / 1) | Consumption (0.5 / 1) |
| App Insights | Workspace-based | Workspace-based | Workspace-based |

### Region

**`canadacentral`** only. This is a data-residency constraint from the architecture — do not deploy to any other region. SWA has limited regional availability; if a SWA resource errors on region, fall back to `eastus2` and document the exception in the README (noting that user data is NOT stored in SWA — it's a static CDN).

### Azure resource naming convention

Pattern: `cems-{env}-{service}[-{suffix}]`

| Resource | Name |
|---|---|
| Resource group | `cems-{env}-rg` |
| SQL server | `cems-{env}-sql-{uniqueHash}` |
| SQL database | `cems` |
| Redis | `cems-{env}-redis-{uniqueHash}` |
| Storage account | `cems{env}st{uniqueHash}` (storage accounts disallow hyphens + must be globally unique, 24 char max, lowercase) |
| Key Vault | `cems-{env}-kv-{uniqueHash}` (24 char max) |
| App Service plan | `cems-{env}-asp` |
| API App Service | `cems-{env}-api` |
| Container Apps env | `cems-{env}-cae` |
| Container App (calc) | `cems-{env}-calc` |
| Static Web App (audit) | `cems-{env}-swa-audit` |
| Static Web App (admin) | `cems-{env}-swa-admin` |
| Static Web App (client) | `cems-{env}-swa-client` |
| VNet | `cems-{env}-vnet` |
| App Insights | `cems-{env}-appi` |
| Log Analytics Workspace | `cems-{env}-log` |

`{uniqueHash}` = `uniqueString(resourceGroup().id, 'cems', env)` in Bicep — deterministic 13-char hash.

### Key Vault secret naming convention

All secret names use kebab-case: `database-url`, `jwt-secret`, `jwt-refresh-secret`, `azure-storage-connection-string`, `redis-url`, `resend-api-key`, `claude-api-key`, `appinsights-connection-string`.

### Managed identity + RBAC (NOT access policies)

- App Service + Container Apps enable system-assigned managed identity
- Key Vault is configured with `enableRbacAuthorization: true`
- Grant `Key Vault Secrets User` (role def id `4633458b-17de-408a-b874-0445c86b69e6`) to each managed identity scoped to the kv resource
- App settings use Key Vault references: `@Microsoft.KeyVault(VaultName=cems-dev-kv-xxx;SecretName=database-url)` — runtime-resolved by App Service automatically

### Blob Storage container setup

- Containers: `audit-photos`, `audit-reports` — both `publicAccess: 'None'`
- All access via server-issued SAS tokens (short TTL, read-only for clients)
- Architecture mandate: photos are state-gated (locked at `IN_REVIEW`, immutable at `APPROVED`); the state-gating is enforced in API service code (Story 4.2 / 7.4), not at the storage layer

### `azure-blob.ts` utility contract

File location: `apps/api/src/lib/azure-blob.ts` (replaces the `.gitkeep` from Story 0.1).

```typescript
import { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions } from '@azure/storage-blob'
import { z } from 'zod'

const sasTtlSchema = z.number().int().min(1).max(60)

export function getBlobServiceClient(): BlobServiceClient {
  const connectionString = process.env['AZURE_STORAGE_CONNECTION_STRING']
  if (!connectionString) throw new Error('AZURE_STORAGE_CONNECTION_STRING is not set')
  return BlobServiceClient.fromConnectionString(connectionString)
}

export async function uploadBlob(container: string, blobName: string, data: Buffer | string, contentType: string): Promise<string> {
  const svc = getBlobServiceClient()
  const client = svc.getContainerClient(container).getBlockBlobClient(blobName)
  await client.upload(data, Buffer.byteLength(data), { blobHTTPHeaders: { blobContentType: contentType } })
  return client.url
}

export function generateReadSasToken(container: string, blobName: string, ttlMinutes: number): string {
  const ttl = sasTtlSchema.parse(ttlMinutes)
  // Implementation uses generateBlobSASQueryParameters with BlobSASPermissions.parse('r') and expiresOn = now + ttl
  // See: https://learn.microsoft.com/en-us/javascript/api/@azure/storage-blob/generateblobsasqueryparameters
  // ... full body to implement
  return ''
}
```

### Deferred to later stories (do NOT include in this story)

- **Private endpoints** for SQL / Redis / Storage — Bicep module parameter but only enabled in staging + prod; dev uses public endpoints with Azure Firewall IP allowlist for developer convenience
- **Azure DNS zones** for private endpoints
- **Managed HSM / Key Vault Premium** — stays Standard per architecture
- **Application Gateway / WAF** — not in architecture for MVP
- **Azure Front Door** — not in architecture for MVP
- **Deployment slot swap automation** — Story 0.6 (CI/CD) handles the GitHub Actions workflow; this story just provisions the slot
- **Actual Azure deployment execution** — `az bicep build` + `what-if` are the acceptance criteria; real `deployment sub create` happens when operator runs `deploy.sh` out-of-band

### Learnings from Story 0.1 — apply consistently

- **Exact version pinning** — pin all parameter default SKU strings; no wildcards or "latest"
- **Non-root + least privilege** — managed identities for everything; no storage keys or SQL admin passwords in App Service settings
- **Validate inputs at system boundaries** — Zod validation in `azure-blob.ts` for SAS TTL
- **No console.log** — use Pino logger when Story 0.4 lands; for this story `azure-blob.ts` throws on misconfiguration, doesn't log
- **Architecture-driven naming** — adhere to `cems-{env}-{service}` across all Bicep resources
- **Turbo 2.x `tasks` key** — if any infra scripts land in `turbo.json`, confirm they use `tasks:` (already done in Story 0.1)

### Architecture references

- Azure services topology + SKUs — [Source: architecture.md#Azure Services Topology]
- Three environments: dev/staging/prod — [Source: architecture.md#Three Environments]
- Canada Central region constraint — [Source: architecture.md#Technical Constraints & Dependencies]
- Managed identity + Key Vault for secrets — [Source: architecture.md#Azure Key Vault] + [Source: architecture.md#Enforcement Guidelines] (rule #7: never commit secrets)
- Container Apps internal-only ingress — [Source: architecture.md#Calc Service Communication]
- Static Web Apps: preview URLs — [Source: architecture.md#CI/CD]

### Project structure notes

- New top-level directory: `infra/bicep/`. NOT inside `apps/` or `packages/` — infrastructure is orthogonal to the monorepo workspace (not a Turborepo package)
- Bicep files not included in `turbo.json` pipeline (no `build`/`test` script registered) — `az bicep build` runs independently in the infra deploy script and (Story 0.6) GitHub Actions
- `apps/api/src/lib/azure-blob.ts` is the first real source file in `apps/api/src/lib/`; removes the `.gitkeep`. Update `apps/api/package.json` if needed — but `@azure/storage-blob` and `zod` are already declared

### References

- Epics: Story 0.2 acceptance criteria — [Source: epics.md#Story 0.2]
- Story 0.1 scaffold foundation — [Source: _bmad-output/implementation-artifacts/0-1-turborepo-monorepo-and-shared-package-scaffold.md]
- Story 0.1 review learnings — [Source: _bmad-output/implementation-artifacts/0-1-turborepo-monorepo-and-shared-package-scaffold.md § Review Findings]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
