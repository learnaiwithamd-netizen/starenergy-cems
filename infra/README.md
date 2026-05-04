# CEMS Infrastructure Runbook

Bicep templates + GitHub Actions wiring for `cems-dev`, `cems-staging`, `cems-prod` Azure environments.

## Layout

```
infra/
├── bicep/
│   ├── main.bicep                       # Subscription-scope composition (creates RG + everything)
│   ├── envs/{dev,staging,prod}/main.bicepparam
│   └── modules/                         # Per-resource Bicep modules
└── scripts/
    ├── build-and-push-calc.sh           # Manual calc-service image push (CI takes over post-0.6)
    └── sync-swa-tokens.sh               # One-shot: copy SWA deploy tokens into GH repo secrets
```

## Bootstrap order — first-time CI/CD wiring

The OIDC federated identity has a chicken-and-egg problem: the workflow
that deploys it needs *some* Azure auth to run. We resolve it by
provisioning everything else first under a temporary service principal,
then deploying the federated identity, then deleting the bootstrap SP.

### Step 1 — Provision the resource group + infra (human, workstation)

```bash
cd infra/bicep
export CEMS_SQL_ADMIN_PASSWORD='choose-a-strong-password'
./deploy.sh dev          # creates ACR, calc app, SWAs, App Service, Key Vault, ...
                         # `enableGithubFederation = true` is the default; this
                         # also creates the cems-dev-gh-mi managed identity.
```

For staging and prod, repeat with the matching env. Prod requires `enableSqlThreatDetection = true`
and `enableKeyVaultPurgeProtection = true` (already in `envs/prod/main.bicepparam`).

### Step 2 — Capture the GH MI client id per env

```bash
az identity show -n cems-dev-gh-mi -g cems-dev-rg --query clientId -o tsv
az identity show -n cems-staging-gh-mi -g cems-staging-rg --query clientId -o tsv
az identity show -n cems-prod-gh-mi -g cems-prod-rg --query clientId -o tsv
```

### Step 3 — Set GitHub repo variables

In **Settings → Secrets and variables → Actions → Variables**:

| Variable | Value |
|---|---|
| `AZURE_TENANT_ID` | `az account show --query tenantId -o tsv` |
| `AZURE_SUBSCRIPTION_ID` | `az account show --query id -o tsv` |
| `AZURE_CLIENT_ID` | (dev MI client id) — used by PR previews |
| `AZURE_CLIENT_ID_STAGING` | (staging MI client id) — used by `deploy-staging.yml` |
| `AZURE_CLIENT_ID_PROD` | (prod MI client id) — used by `deploy-prod.yml` |

These are **variables**, not **secrets** — they're not sensitive (the federated
credential subject claim is what gates access).

### Step 4 — Sync SWA deployment tokens

```bash
./infra/scripts/sync-swa-tokens.sh dev      # writes AZURE_SWA_AUDIT_TOKEN, ...ADMIN_TOKEN, ...CLIENT_TOKEN
./infra/scripts/sync-swa-tokens.sh staging  # writes the *_STAGING variants
./infra/scripts/sync-swa-tokens.sh prod     # writes the *_PROD variants
```

These tokens **are** secrets and go to **Settings → Secrets and variables → Actions → Secrets**.

### Step 5 — Configure the GitHub `production` environment

In **Settings → Environments → New environment → `production`**:
- Add at least one **Required reviewer** (yourself, plus anyone you trust to approve a prod release).
- Optional: restrict to `main` branch.

The `staging` environment can be created without required reviewers — the
deploy-staging.yml workflow uses it only for env-scoped secrets.

### Step 6 — Smoke-test with a dry PR

Open a comment-only PR. Confirm:
- `ci.yml` runs and turns green.
- `swa-preview` job posts the 3 preview URLs as a sticky comment.
- `actionlint` passes.
- (Optional) Touch `apps/calc-service/app/models/refrigerant.py` in a follow-up PR — confirm `calc-schema-parity` fails the PR with a useful diff.

## Rollback procedures

### API rolled back via slot swap

If a production API release is broken, swap the slots back manually:

```bash
az webapp deployment slot swap \
  --resource-group cems-prod-rg \
  --name cems-prod-api \
  --slot production \
  --target-slot staging
```

The previous code is sitting in the staging slot (warm, ready). Swap is
~1 second of LB cutover.

### calc-service rolled back via revision activation

Container Apps keeps the last 10 revisions. Activate a previous one:

```bash
az containerapp revision list \
  -n cems-prod-calc -g cems-prod-rg \
  --query "[].{name:name,active:properties.active,createdTime:properties.createdTime}" -o table

az containerapp revision activate \
  -n cems-prod-calc -g cems-prod-rg \
  --revision cems-prod-calc--abc1234   # <- previous good revision
```

### SPA rolled back via redeploy

`deploy-staging.yml` and `deploy-prod.yml` both check out `inputs.sha`.
To roll back a frontend, run `deploy-prod.yml` again with the previous
known-good SHA.

## Provisioned modules

| Module | Purpose |
|---|---|
| `network.bicep` | VNet + 3 subnets (apps / containers / data) |
| `keyvault.bicep` | Standard KV with RBAC, purge protection on staging/prod |
| `kvSecret.bicep` + `kvRoleAssignment.bicep` | Secret seeding + RBAC grants |
| `sql.bicep` | Azure SQL S2 + RLS-ready DB |
| `redis.bicep` | Azure Cache for Redis (BullMQ) |
| `storage.bicep` | LRS blob storage (photos, PDFs) |
| `appinsights.bicep` | Application Insights + Log Analytics |
| `appservice.bicep` | Linux Node 22 App Service (+ prod staging slot for swap) |
| `staticwebapps.bicep` | 3× SWA (audit, admin, client-portal) |
| `containerapps.bicep` | Container Apps Env + calc-service Container App |
| `acr.bicep` | Azure Container Registry (calc image) |
| `acrRoleAssignment.bicep` | AcrPull / AcrPush role grants |
| `githubFederatedIdentity.bicep` | OIDC managed identity for GitHub Actions |

## CI/CD workflows (Story 0.6)

- `.github/workflows/ci.yml` — PR validation: `turbo run lint type-check test build`, SWA previews, calc schema-parity, actionlint.
- `.github/workflows/deploy-staging.yml` — push-to-`main`: builds + pushes calc image (SHA-tagged), runs Prisma migrations, deploys SPAs, slot-swap deploys API, smoke-tests, auto-rolls-back on failure.
- `.github/workflows/deploy-prod.yml` — manual `workflow_dispatch`: verifies SHA passed staging, halts at `production` environment for required-reviewer approval, then mirrors the staging deploy steps against prod resources, tags `release/{sha}`.

## When something fails

- **First deploy of a new env: `ImagePullBackOff` on the calc Container App.**
  ACR role propagation is eventually consistent (30–120s). Wait, then `az containerapp revision restart`.
- **`deploy-prod.yml` doesn't show up in workflow_dispatch list.**
  Push the workflow file to `main` first — `workflow_dispatch` only lists workflows present on the default branch.
- **CI fails with `Definition for rule '...' was not found`.**
  Run `pnpm install` locally so the typescript-eslint plugin resolves.
- **Schema parity job fails after a Pydantic change.**
  Run `pnpm --filter api calc-schemas:check` locally to see the diff. Fix `apps/api/src/lib/calc-service-schemas.ts` to match.
- **Bicep deploy fails with `RoleAssignmentExists` after a teardown.**
  GUID seeds for role assignments include the principal id; soft-deleted MIs that get recreated reuse the same id but the assignment is stuck. Manually delete the role assignment in the portal, then redeploy.
