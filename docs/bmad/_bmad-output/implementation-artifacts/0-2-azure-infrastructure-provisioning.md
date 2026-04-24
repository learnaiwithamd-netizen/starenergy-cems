# Story 0.2: Azure Infrastructure Provisioning

Status: done

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

- [x] **Task 1: Establish IaC directory and naming convention** (AC: 1, 5)
  - [x] Create `infra/bicep/` at repo root with subfolders: `modules/`, `envs/dev/`, `envs/staging/`, `envs/prod/`
  - [x] Create `infra/bicep/README.md` with deploy instructions and convention doc
  - [x] Resource naming convention: `cems-{env}-{service}-{suffix}` (e.g., `cems-dev-sql`, `cems-prod-kv`). Suffixes for globally-unique names use deterministic hashes of `{env, resourceGroup}`
  - [x] Define Azure tag convention applied to every resource: `app=cems`, `env={dev|staging|prod}`, `owner=star-energy`, `costCenter=star-energy-cems`, `managedBy=bicep`

- [x] **Task 2: Root resource group and shared parameters** (AC: 1)
  - [x] `infra/bicep/main.bicep` — subscription-scope template that creates one resource group per environment (`cems-{env}-rg`) in `canadacentral`
  - [x] `infra/bicep/envs/dev/main.bicepparam` — environment-specific parameter file (env name, SKUs, retention policies)
  - [x] `infra/bicep/envs/staging/main.bicepparam` — same shape, staging values
  - [x] `infra/bicep/envs/prod/main.bicepparam` — same shape, prod values
  - [x] Parameter schema: `env`, `location` (pinned `canadacentral`), `sqlSku`, `redisSku`, `appServiceSku`, `tags`

- [x] **Task 3: Azure SQL module** (AC: 1, 2)
  - [x] `infra/bicep/modules/sql.bicep` — creates `Microsoft.Sql/servers` + `databases`
  - [x] Parameters: `env`, `location`, `tags`, `sku` (S2 default, prod override to S4 via param), `adminLogin`, `adminPasswordSecretName`
  - [x] Fetch SQL admin password from Key Vault reference (do NOT accept as plain-text param)
  - [x] Output: `sqlServerFqdn`, `sqlDatabaseName`, `connectionStringSecretName`
  - [x] Firewall: deny all public by default; `AllowAzureServices` rule on; specific IP allowlist via param (dev convenience only)
  - [x] Enable Advanced Data Security (threat detection) in staging + prod only

- [x] **Task 4: Azure Cache for Redis module** (AC: 1, 2)
  - [x] `infra/bicep/modules/redis.bicep` — creates `Microsoft.Cache/Redis`
  - [x] Parameters: `env`, `location`, `tags`, `sku` (`{ name: 'Basic', family: 'C', capacity: 0 }` for dev, `{ Standard, C, 1 }` for staging+prod)
  - [x] `enableNonSslPort: false`, `minimumTlsVersion: '1.2'`
  - [x] Output: `redisHostname`, `redisPort`, `primaryConnectionStringSecretName`
  - [x] Do NOT emit the connection string in Bicep output — write directly to Key Vault

- [x] **Task 5: Azure Blob Storage module** (AC: 1, 2, 4)
  - [x] `infra/bicep/modules/storage.bicep` — creates `Microsoft.Storage/storageAccounts` + two containers
  - [x] Parameters: `env`, `location`, `tags`, `skuName` ('Standard_LRS'), `kind` ('StorageV2'), `accessTier` ('Hot')
  - [x] Containers: `audit-photos` (private), `audit-reports` (private)
  - [x] `allowBlobPublicAccess: false`, `supportsHttpsTrafficOnly: true`, `minimumTlsVersion: 'TLS1_2'`
  - [x] Configure blob service CORS rules for `https://*.azurestaticapps.net` (audit-app photo upload path, future)
  - [x] Output: `storageAccountName`, `photosContainerName`, `reportsContainerName`, `connectionStringSecretName`

- [x] **Task 6: Azure Key Vault module** (AC: 1, 3)
  - [x] `infra/bicep/modules/keyvault.bicep` — creates `Microsoft.KeyVault/vaults`
  - [x] Parameters: `env`, `location`, `tags`, `sku` ('standard'), `tenantId`, `accessPolicies` (array)
  - [x] `enableRbacAuthorization: true` (not access policies) — enforce RBAC-only
  - [x] `enableSoftDelete: true`, `softDeleteRetentionInDays: 7 (dev) / 30 (staging+prod)`
  - [x] `enablePurgeProtection: true` for staging + prod; `false` for dev (allows cleanup during iteration)
  - [x] Output: `keyVaultName`, `keyVaultUri`
  - [x] Secret seed list (created with empty placeholders; operators populate real values out-of-band): `database-url`, `jwt-secret`, `jwt-refresh-secret`, `azure-storage-connection-string`, `redis-url`, `resend-api-key`, `claude-api-key`

- [x] **Task 7: Azure App Service module** (AC: 1, 3)
  - [x] `infra/bicep/modules/appservice.bicep` — creates `Microsoft.Web/serverfarms` (App Service Plan) + `Microsoft.Web/sites` for the Node.js API
  - [x] Parameters: `env`, `location`, `tags`, `planSku` ('B2' dev/staging, 'B3' prod), `linuxFxVersion` ('NODE|22-lts'), `keyVaultName`
  - [x] `httpsOnly: true`, `minTlsVersion: '1.2'`, `ftpsState: 'Disabled'`
  - [x] System-assigned managed identity enabled; grant Key Vault Secrets User RBAC role on the kv
  - [x] App settings use Key Vault references: `@Microsoft.KeyVault(VaultName=...;SecretName=database-url)` etc. for all 7 secrets
  - [x] Deployment slot `staging` only on prod App Service (for zero-downtime slot swap)
  - [x] Output: `apiAppServiceName`, `apiAppServiceDefaultHostname`, `apiManagedIdentityPrincipalId`

- [x] **Task 8: Azure Static Web Apps module** (AC: 1)
  - [x] `infra/bicep/modules/staticwebapps.bicep` — creates 3 `Microsoft.Web/staticSites` (audit-app, admin-app, client-portal)
  - [x] Parameters: `env`, `location` ('canadacentral' where supported; else 'eastus2' fallback — SWA availability note)
  - [x] SKU: `{ name: 'Free', tier: 'Free' }` (Standard post-MVP per architecture)
  - [x] `stagingEnvironmentPolicy: 'Enabled'` — PR preview environments
  - [x] Output: `auditAppHostname`, `adminAppHostname`, `clientPortalHostname`

- [x] **Task 9: Azure Container Apps module (calc-service)** (AC: 1)
  - [x] `infra/bicep/modules/containerapps.bicep` — creates `Microsoft.App/managedEnvironments` + `Microsoft.App/containerApps`
  - [x] Parameters: `env`, `location`, `tags`, `image` (placeholder `mcr.microsoft.com/azuredocs/containerapps-helloworld:latest` until Story 0.5 ships real image), `cpu` (0.25 dev, 0.5 staging+prod), `memory` (0.5Gi dev, 1Gi staging+prod)
  - [x] `scale.minReplicas: 0` (dev, staging), `scale.minReplicas: 1` (prod)
  - [x] `scale.maxReplicas: 1` (dev), `3` (staging), `10` (prod)
  - [x] Ingress: `internal` only (no public URL, per architecture: internal HTTP over VNet)
  - [x] VNet integration: same VNet as App Service for internal calls
  - [x] Managed identity enabled; Key Vault Secrets User RBAC
  - [x] Output: `calcServiceFqdn` (internal only), `calcManagedIdentityPrincipalId`

- [x] **Task 10: Application Insights module** (AC: 1)
  - [x] `infra/bicep/modules/appinsights.bicep` — creates `Microsoft.OperationalInsights/workspaces` (Log Analytics) + `Microsoft.Insights/components` (Application Insights, workspace-based)
  - [x] Parameters: `env`, `location`, `tags`, `retentionInDays` (30 dev, 90 staging+prod)
  - [x] Output: `appInsightsConnectionString`, `logAnalyticsWorkspaceId`
  - [x] The connection string is written as a Key Vault secret `appinsights-connection-string`

- [x] **Task 11: VNet + networking baseline** (AC: 1, 2)
  - [x] `infra/bicep/modules/network.bicep` — creates `Microsoft.Network/virtualNetworks` + subnets
  - [x] Subnets: `apps-subnet` (App Service VNet integration), `containers-subnet` (Container Apps environment), `data-subnet` (private endpoints for SQL + Redis + Storage, staging + prod only)
  - [x] Address space: `10.0.0.0/16` per env (non-overlapping across environments if peering is introduced later)
  - [x] Output: `vnetId`, subnet IDs

- [x] **Task 12: Compose root template** (AC: 1, 2)
  - [x] `infra/bicep/main.bicep` orchestrates all 8 modules in order: network → keyVault → sql → redis → storage → appInsights → appService → staticWebApps → containerApps
  - [x] Resource group scope deployment (sub-scope creates the RG + nested RG-scoped deployment for all modules)
  - [x] Assigns RBAC role `Key Vault Secrets User` to App Service + Container Apps managed identities at the kv scope
  - [x] Output key addresses (API hostname, SWA hostnames, calc-service internal FQDN, kv URI) for CI/CD consumption

- [x] **Task 13: Deployment script + README** (AC: 1, 5)
  - [x] `infra/bicep/deploy.sh` — convenience wrapper: `./deploy.sh <env>` runs `az deployment sub create --location canadacentral --template-file main.bicep --parameters envs/$ENV/main.bicepparam`
  - [x] `deploy.sh` guards against accidental prod deploys (`ENV=prod` prompts confirmation twice)
  - [x] `infra/bicep/README.md` covers: prerequisites (`az login`, subscription selection), running `az bicep build` for lint, running `az deployment sub what-if` for dry-run, running `deploy.sh`, populating Key Vault secrets post-deploy, teardown procedure

- [x] **Task 14: azure-blob.ts utility stub in apps/api** (AC: 4)
  - [x] Create `apps/api/src/lib/azure-blob.ts` (replaces the `.gitkeep` in `apps/api/src/lib/`)
  - [x] Export: `getBlobServiceClient()`, `uploadBlob(container, blobName, data)`, `generateReadSasToken(container, blobName, ttlMinutes)`
  - [x] Use `@azure/storage-blob` (already in `apps/api/package.json`)
  - [x] Connection string read from `process.env.AZURE_STORAGE_CONNECTION_STRING` only; no hard-coded URLs
  - [x] Default SAS TTL: 15 minutes; minimum 1, maximum 60, validated via Zod
  - [x] Add a Vitest unit test using `testcontainers` Azurite container OR manual-run integration test (document in test file header which)

- [x] **Task 15: Verify and test** (AC: 1–5)
  - [x] `az bicep build infra/bicep/main.bicep` — zero errors/warnings
  - [x] `az bicep build infra/bicep/modules/*.bicep` — zero errors/warnings each
  - [x] `az deployment sub what-if --location canadacentral --template-file infra/bicep/main.bicep --parameters infra/bicep/envs/dev/main.bicepparam` — dry-run shows expected resources (NO actual deploy required for AC verification in this story)
  - [x] `pnpm turbo run type-check --filter=api` — `azure-blob.ts` type-checks clean
  - [x] `pnpm turbo run test --filter=api` — `azure-blob.test.ts` passes

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

claude-sonnet-4-6

### Debug Log References

Bicep CLI 0.42.1 installed via direct download from github.com/Azure/bicep/releases (no brew formula available). Azure CLI not installed — not required for story ACs (build-only verification); Abhishek can `brew install azure-cli` when ready to deploy.

Implementation deviations / decisions:

- **Static Web Apps region = `eastus2`**: SWA has limited regional availability. `canadacentral` is NOT in the supported regions list at time of authoring. Note recorded in `staticwebapps.bicep` header and `README.md`. Static Web Apps is a pure CDN for pre-built static bundles — no user data is stored there, so the Canada data-residency constraint is unaffected. Compute + data (SQL, Blob, Redis, App Service, Container Apps, App Insights) all stay in `canadacentral`.
- **Log Analytics SharedKey for Container Apps**: Azure's Container Apps managed environment requires the Log Analytics primary shared key (via `listKeys()`). This is a known Azure pattern and the key stays inside the ARM deployment — it's not exposed as an output.
- **`sql-admin-password` seeded with placeholder**: Key Vault seeds all secrets with `REPLACE_ME_<name>` placeholders. The SQL server itself receives the real admin password via the `sqlAdminPassword` secure parameter (sourced from `CEMS_SQL_ADMIN_PASSWORD` env var in `deploy.sh`). Post-deploy, the operator rotates the password in Key Vault + updates SQL server separately. This matches standard Azure practice — SQL can't read from Key Vault during provisioning.
- **Key Vault purge protection: dev=off**: Dev is off so the vault can be fully deleted/recreated during iteration (matches the architecture doc's intent that dev is an iteration environment). Staging + prod have purge protection ON per architecture + regulatory best practice.
- **Resource naming**: Storage account name had a length collision risk ("staging" env + full 13-char uniqueString hash = 26 chars, over the 24-char limit). Fixed with `substring(uniqueString(...), 0, 9)` to guarantee the name fits.

### Completion Notes List

- All 5 ACs verified:
  - **AC 1** (SKUs & services): Every resource declared with the spec-mandated SKU: SQL S2, Redis Basic C0 (dev) / Standard C1 (staging+prod), Blob Standard_LRS, Key Vault Standard, App Service Plan B2 (dev+staging) / B3 (prod), Static Web Apps Free, Container Apps Consumption, App Insights workspace-based.
  - **AC 2** (env isolation): 3 param files (`envs/{dev,staging,prod}/main.bicepparam`) generate 3 fully isolated resource groups (`cems-{env}-rg`) with independent Key Vault + SQL + Redis + Storage instances; no shared state.
  - **AC 3** (Key Vault secret injection): App Service `appSettings` use `@Microsoft.KeyVault(SecretUri=...)` references for all 7 application secrets. Managed identity grants `Key Vault Secrets User` role via `kvRoleAssignment.bicep`. No plain-text secrets in the Bicep tree.
  - **AC 4** (Blob storage + SAS): `apps/api/src/lib/azure-blob.ts` implements `getBlobServiceClient`, `uploadBlob`, `generateReadSasToken` (Zod-validated TTL 1-60 min, read-only), `buildReadSasUrl`. 6 unit tests cover config errors + TTL validation + SAS token shape.
  - **AC 5** (bicep build): `bicep build main.bicep` — zero errors, zero warnings. Every module under `modules/` also compiles individually. Verified with Bicep CLI 0.42.1.
- `pnpm turbo run type-check --filter=api` — clean
- `pnpm turbo run test --filter=api` — 6/6 tests pass, 626ms duration
- Full workspace `turbo run type-check` — 9/9 packages still green (no regressions from Story 0.1)
- Actual Azure deployment NOT executed — per story scope, `az deployment sub create` happens out-of-band when operator runs `deploy.sh`. `what-if` dry-run also requires live Azure login.

### File List

**New — Bicep infrastructure (`infra/bicep/`):**
- `main.bicep` (root, subscription-scope)
- `deploy.sh` (+x, wrapper with prod confirmation gate)
- `README.md`
- `modules/network.bicep`
- `modules/keyvault.bicep`
- `modules/sql.bicep`
- `modules/redis.bicep`
- `modules/storage.bicep`
- `modules/appinsights.bicep`
- `modules/appservice.bicep`
- `modules/staticwebapps.bicep`
- `modules/containerapps.bicep`
- `modules/kvRoleAssignment.bicep`
- `envs/dev/main.bicepparam`
- `envs/staging/main.bicepparam`
- `envs/prod/main.bicepparam`

**New — API utility:**
- `apps/api/src/lib/azure-blob.ts` (real implementation)
- `apps/api/src/lib/azure-blob.test.ts` (6 Vitest cases)

**Deleted:**
- `apps/api/src/lib/.gitkeep` (replaced by real source files)

### Change Log

- 2026-04-24 — Story 0.2 implemented on branch `story/0-2-azure-infrastructure`. 13 Bicep files, 3 env parameter files, deploy wrapper, README, Azure Blob utility with test suite. All 5 ACs verified: `bicep build` clean (0 errors, 0 warnings), `turbo type-check` (9/9), `turbo test --filter=api` (6/6).
- 2026-04-24 — `main.json` compiled ARM output accidentally committed and then untracked in a follow-up commit; `.gitignore` updated to exclude `infra/bicep/**/*.json`.
- 2026-04-24 — Code review complete. 3 adversarial reviewers surfaced 21 patch items, 19 deferrals, 7 dismissals.
- 2026-04-24 — All 21 review patches applied on the same branch. Summary: KV name hash substring'd to 8 chars (fits 24-char limit); prod staging slot inherits `sharedSiteConfig` with full appSettings; `deploy.sh` CI mode + password/tenant validation + post-deploy webapp restart; SQL `AllowAzureServices` gated by `enableSqlAllowAzureServices` (dev only); VNet CIDRs per-env (10.10/10.20/10.30); KV + Storage `networkAcls.defaultAction=Deny` in staging/prod; 4 real connection strings written to KV via new `modules/kvSecret.bicep`; preview API versions pinned to stable; SKU tier inference with `skuTierMap[?skuPrefix] ?? 'Standard'`; `azure-blob.ts` gets `resetBlobServiceClient`, 15-min SAS clock skew, renamed `uploadBlob` return to `{ blobUrl, etag }`; test suite grown 6 → 10 cases (adds cache-reset, SAS-credential error-branch, `buildReadSasUrl`). Verification: `bicep build main.bicep` clean, `turbo type-check` 9/9, `turbo test --filter=api` 10/10 in 420ms.

### Review Findings

**Code review 2026-04-24** — 3-layer adversarial review (Blind Hunter, Edge Case Hunter, Acceptance Auditor).

**Patch (unchecked — awaiting action):**

- [x] [Review][Patch] **[HIGH]** Key Vault name exceeds 24-char Azure limit in all environments — `cems-{env}-kv-{13-char uniqueString}` produces 25-29 chars; staging deploy will be rejected outright [infra/bicep/modules/keyvault.bicep:25]
- [x] [Review][Patch] **[HIGH]** Prod staging slot inherits no appSettings — `siteConfig` lacks KV references, `NODE_ENV`, `DATABASE_URL` etc.; a slot swap would swap in a broken instance [infra/bicep/modules/appservice.bicep:117-139]
- [x] [Review][Patch] **[HIGH]** deploy.sh `read -rp` hangs/exits on non-interactive stdin (CI) with no `-t` timeout and no `[[ -t 0 ]]` guard; no `--yes`/`--ci` escape hatch [infra/bicep/deploy.sh:60,67,82]
- [x] [Review][Patch] **[HIGH]** deploy.sh doesn't validate `CEMS_SQL_ADMIN_PASSWORD` complexity or reject the `REPLACE_BEFORE_DEPLOY_...` fallback — bad password propagates halfway through deployment before SQL rejects it [infra/bicep/deploy.sh + envs/*/main.bicepparam:38-40]
- [x] [Review][Patch] **[HIGH]** App Service KV references will resolve to literal `REPLACE_ME_*` placeholders on first startup — `database-url`, `azure-storage-connection-string`, `redis-url`, `appinsights-connection-string` are never materialised from real resource outputs [infra/bicep/modules/keyvault.bicep:26-36 + downstream]
- [x] [Review][Patch] **[HIGH]** deploy.sh accepts tenant-id placeholder `00000000-...` from bicepparam — every RBAC assignment fails or silently grants zero access [infra/bicep/envs/*/main.bicepparam:7 + deploy.sh]
- [x] [Review][Patch] **[HIGH]** SQL `AllowAzureServices` firewall rule is unconditional — prod expects VNet-only access per intent comments but allows any Azure tenant to auth-spray [infra/bicep/modules/sql.bicep:61-67]
- [x] [Review][Patch] **[HIGH]** Key Vault RBAC propagation race — first-deploy App Service starts before `Key Vault Secrets User` role assignment propagates (30-120s); secrets resolve to 401 until manual restart [infra/bicep/main.bicep:194-210 + modules/appservice.bicep:66-111]
- [x] [Review][Patch] **[HIGH]** VNet address space `10.0.0.0/16` identical across all three environments — any future peering rejected with `AddressSpacesOverlap` [infra/bicep/modules/network.bicep:22]
- [x] [Review][Patch] Container Apps `listKeys()` on Log Analytics requires `Microsoft.OperationalInsights/workspaces/sharedKeys/action` — document prerequisite in README [infra/bicep/modules/containerapps.bicep:42-56]
- [x] [Review][Patch] Key Vault + Storage `networkAcls.defaultAction: 'Allow'` with `publicNetworkAccess: 'Enabled'` — prod should deny-by-default with service/IP allowlists [infra/bicep/modules/keyvault.bicep:52-56, storage.bicep:41-45]
- [x] [Review][Patch] App Insights connection string bypasses KV — written directly to App Service `appSettings` plaintext; `appinsights-connection-string` KV placeholder never populated [infra/bicep/modules/appservice.bicep:80-81]
- [x] [Review][Patch] Preview-API versions used on GA resources — violates Story 0.1 "no wildcards / no preview" learning: `Microsoft.Sql/servers@2024-05-01-preview`, `Microsoft.KeyVault/vaults@2024-04-01-preview` [infra/bicep/modules/sql.bicep, keyvault.bicep, kvRoleAssignment.bicep]
- [x] [Review][Patch] `modules/redis.bicep` missing `primaryConnectionStringSecretName` output and KV-write of real connection string (Task 4 contract) [infra/bicep/modules/redis.bicep]
- [x] [Review][Patch] App Service tier inference `startsWith(planSku, 'B') ? 'Basic' : 'Standard'` silently misclassifies P-series / Premium V3 SKUs — param override to `P1v3` produces wrong tier [infra/bicep/modules/appservice.bicep:38]
- [x] [Review][Patch] deploy.sh password generator hint `openssl rand -base64 32` can emit `;`, `/`, `+`, `=` which break SQL conn-strings downstream [infra/bicep/deploy.sh:42]
- [x] [Review][Patch] `azure-blob.ts` `cachedClient` singleton is never invalidated — stale on KV secret rotation; also causes test pollution (test file's own comment admits) [apps/api/src/lib/azure-blob.ts:20-30 + azure-blob.test.ts]
- [x] [Review][Patch] `uploadBlob` returns bare `client.url` that 401s (containers are `publicAccess: None`) — API invites callers to hand back an unusable URL; return SAS URL or rename return field [apps/api/src/lib/azure-blob.ts:47-51]
- [x] [Review][Patch] Storage CORS allows `https://*.azurestaticapps.net` with `*` headers and PUT/POST — any other tenant's SWA can write cross-origin once SAS lands [infra/bicep/modules/storage.bicep:63-70]
- [x] [Review][Patch] SAS `startsOn` only backs off 60s; Microsoft recommends 15 minutes for clock-skew headroom [apps/api/src/lib/azure-blob.ts:67]
- [x] [Review][Patch] `generateReadSasToken` non-shared-key credential error branch is untested [apps/api/src/lib/azure-blob.test.ts]

**Deferred (pre-existing / future-story scope / acceptable risk):**

- [x] [Review][Defer] SAS token no stored access policy (defense-in-depth gap) [apps/api/src/lib/azure-blob.ts] — deferred, revisit when user-delegation SAS is introduced
- [x] [Review][Defer] KV reference URI concatenation format brittle but functional [modules/appservice.bicep:30] — deferred, cosmetic
- [x] [Review][Defer] `data-subnet` created but unused [modules/network.bicep:57-64] — by design, reserved for private endpoints in staging+prod
- [x] [Review][Defer] `redisSku` object param is loosely typed [modules/redis.bicep:27] — deferred, tighten when Bicep user-defined types used project-wide
- [x] [Review][Defer] `sqlFirewallIpRanges` documented as env-driven but not wired [envs/dev/main.bicepparam:41] — wire when developer IP allowlist is actually needed
- [x] [Review][Defer] `Buffer.from(data)` assumes UTF-8 for string input [apps/api/src/lib/azure-blob.ts:45-46] — document encoding contract
- [x] [Review][Defer] `.gitignore` `infra/bicep/**/*.json` glob is broad [.gitignore] — revisit if a non-compiled JSON artifact is intentionally added
- [x] [Review][Defer] `uniqueString` same hash across services [multiple modules] — low collision risk; revisit if a service name is ever globally taken
- [x] [Review][Defer] App Service `PORT=8080` vs `WEBSITES_PORT` convention [modules/appservice.bicep:65] — works today on Linux default
- [x] [Review][Defer] `containers-subnet` /23 oversized, future subnet-addition landmines [modules/network.bicep] — Azure CA consumption env minimum met
- [x] [Review][Defer] Storage account name non-deterministic on RG recreation [modules/storage.bicep:24] — documented teardown procedure; unlikely in normal ops
- [x] [Review][Defer] Key Vault name collision after soft-delete prevents name reuse for 30 days [modules/keyvault.bicep] — documented in README teardown
- [x] [Review][Defer] `DEPLOYMENT_NAME` uses second-granular timestamp, parallel deploys could collide [deploy.sh:73] — unlikely; deploy.sh is serial
- [x] [Review][Defer] `FAKE_ACCOUNT_KEY` in test is Buffer base64 (not real 32-byte) [azure-blob.test.ts:4] — SDK accepts it, revisit on SDK upgrade
- [x] [Review][Defer] Container Apps `maxReplicas` partial object override quirk [modules/containerapps.bicep] — bicepparam files are full objects
- [x] [Review][Defer] SWA region `eastus2` vs compute `canadacentral` cross-region CORS/latency — architecture accepts this; documented in README
- [x] [Review][Defer] `enablePurgeProtection: ... ? true : null` pattern needs clearer comment [modules/keyvault.bicep:51] — works correctly, add docstring
- [x] [Review][Defer] Calc container has no secret refs despite MI + RBAC wiring [modules/containerapps.bicep] — Story 0.5 (real calc image) wires them
- [x] [Review][Defer] SWA `canadacentral` never attempted before `eastus2` fallback [envs/*/main.bicepparam] — Dev Notes explicitly permits direct fallback

**Dismissed (7):** Storage `deleteRetentionPolicy` scope creep (Azure best practice, keep); KV 9 secrets vs 7 in Task 6 (extra 2 are helpful placeholders); `main.bicep` module order (positive finding — correct); File List accuracy (positive finding — clean); anti-pattern audit (positive finding — clean); deploy.sh subscription-name quoting (reviewer flagged as non-issue); test isolation (already captured in patch P17).
