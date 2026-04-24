#!/usr/bin/env bash
# deploy.sh — provision a CEMS environment on Azure
# Usage: ./deploy.sh <env>                  (interactive, prompts before apply)
#        CI=1 ./deploy.sh <env>             (non-interactive, skips prompts; still runs what-if)
#        CI=1 SKIP_WHATIF=1 ./deploy.sh dev (CI fast-path — skips what-if too, dev only)
#
# Required env vars:
#   CEMS_SQL_ADMIN_PASSWORD   strong SQL admin password (min 16 chars, rejects placeholder)
#
# Exits 2 on usage errors, 1 on deployment errors, 127 on missing tooling.

set -euo pipefail

ENV="${1:-}"
LOCATION="canadacentral"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CI_MODE="${CI:-0}"

# Helper: is stdin a real terminal?
interactive() { [[ -t 0 && -t 1 && "$CI_MODE" != "1" ]]; }

# Helper: prompt or use CI default
prompt_or_default() {
  local prompt="$1"; local default="$2"
  if interactive; then
    local ans
    read -rp "$prompt" ans
    echo "${ans:-$default}"
  else
    echo "$default"
  fi
}

if [[ -z "$ENV" ]]; then
  echo "Usage: $0 <dev|staging|prod>" >&2
  exit 2
fi

case "$ENV" in
  dev|staging|prod) ;;
  *) echo "Error: env must be one of: dev, staging, prod (got '$ENV')" >&2; exit 2 ;;
esac

PARAM_FILE="${SCRIPT_DIR}/envs/${ENV}/main.bicepparam"
TEMPLATE_FILE="${SCRIPT_DIR}/main.bicep"

[[ -f "$PARAM_FILE"    ]] || { echo "Error: parameter file not found: $PARAM_FILE" >&2; exit 2; }
[[ -f "$TEMPLATE_FILE" ]] || { echo "Error: template file not found: $TEMPLATE_FILE" >&2; exit 2; }

command -v az >/dev/null 2>&1 || { echo "Error: Azure CLI (az) not found on PATH. Install: https://aka.ms/install-azure-cli" >&2; exit 127; }

az account show >/dev/null 2>&1 || { echo "Error: not logged in to Azure. Run 'az login' first." >&2; exit 1; }

SUBSCRIPTION_ID=$(az account show --query id -o tsv)
SUBSCRIPTION_NAME=$(az account show --query name -o tsv)
AZ_USER=$(az account show --query user.name -o tsv 2>/dev/null || echo "unknown")

# Validate tenantId in param file is not the placeholder
if grep -qE "tenantId\s*=\s*'00000000-0000-0000-0000-000000000000'" "$PARAM_FILE"; then
  echo "Error: tenantId in $PARAM_FILE is still the placeholder '00000000-...'." >&2
  echo "       Set it to your real tenant id: az account show --query tenantId -o tsv" >&2
  exit 1
fi

# Validate password env var
if [[ -z "${CEMS_SQL_ADMIN_PASSWORD:-}" ]]; then
  echo "Error: CEMS_SQL_ADMIN_PASSWORD env var must be set." >&2
  echo "       Generate a safe password with (alphanumeric only — avoids SQL conn-string injection chars):" >&2
  echo "       export CEMS_SQL_ADMIN_PASSWORD=\"\$(openssl rand -base64 48 | tr -d '/+=' | head -c 32)\"" >&2
  exit 1
fi

# Reject placeholder/weak passwords
if [[ "$CEMS_SQL_ADMIN_PASSWORD" == *"REPLACE"* || "$CEMS_SQL_ADMIN_PASSWORD" == *"PLACEHOLDER"* ]]; then
  echo "Error: CEMS_SQL_ADMIN_PASSWORD looks like a placeholder. Set a real strong password." >&2
  exit 1
fi

PWD_LEN="${#CEMS_SQL_ADMIN_PASSWORD}"
if (( PWD_LEN < 16 )); then
  echo "Error: CEMS_SQL_ADMIN_PASSWORD is only $PWD_LEN chars; Azure SQL requires at least 8 but we enforce 16." >&2
  exit 1
fi

# Warn if password contains chars that break conn strings
if [[ "$CEMS_SQL_ADMIN_PASSWORD" == *";"* || "$CEMS_SQL_ADMIN_PASSWORD" == *"/"* || "$CEMS_SQL_ADMIN_PASSWORD" == *"+"* || "$CEMS_SQL_ADMIN_PASSWORD" == *"="* ]]; then
  echo "Warning: CEMS_SQL_ADMIN_PASSWORD contains ';', '/', '+', or '=' — these can break ADO.NET / URL-style conn strings." >&2
  echo "         Consider regenerating: \$(openssl rand -base64 48 | tr -d '/+=' | head -c 32)" >&2
fi

echo "========================================"
echo "CEMS Infrastructure Deployment"
echo "========================================"
echo "  Environment:   $ENV"
echo "  Location:      $LOCATION"
echo "  Subscription:  $SUBSCRIPTION_NAME ($SUBSCRIPTION_ID)"
echo "  Deployer:      $AZ_USER"
echo "  CI mode:       $CI_MODE"
echo "  Template:      $TEMPLATE_FILE"
echo "  Parameters:    $PARAM_FILE"
echo "========================================"

# Prod confirmation — interactive only; CI mode requires explicit env CEMS_CONFIRM_PROD=yes
if [[ "$ENV" == "prod" ]]; then
  echo "*** PRODUCTION DEPLOYMENT ***"
  if interactive; then
    read -rp "Type 'DEPLOY PROD' to proceed: " CONFIRM1
    [[ "$CONFIRM1" == "DEPLOY PROD" ]] || { echo "Aborted." >&2; exit 1; }
    read -rp "Type the subscription id to confirm: " CONFIRM2
    [[ "$CONFIRM2" == "$SUBSCRIPTION_ID" ]] || { echo "Subscription id mismatch — aborted." >&2; exit 1; }
  else
    [[ "${CEMS_CONFIRM_PROD:-}" == "yes" ]] || {
      echo "Error: prod deploy in CI mode requires CEMS_CONFIRM_PROD=yes" >&2; exit 1
    }
  fi
fi

# Deployment name — include env + nanosecond timestamp for uniqueness under parallel retries
DEPLOYMENT_NAME="cems-${ENV}-$(date +%Y%m%d-%H%M%S)-$$"

if [[ "${SKIP_WHATIF:-0}" != "1" ]]; then
  echo "Running what-if preview..."
  az deployment sub what-if \
    --name "${DEPLOYMENT_NAME}-whatif" \
    --location "$LOCATION" \
    --template-file "$TEMPLATE_FILE" \
    --parameters "$PARAM_FILE" \
    --parameters sqlAdminPassword="$CEMS_SQL_ADMIN_PASSWORD"

  if interactive; then
    read -rp "Proceed with deployment? [y/N]: " PROCEED
    [[ "$PROCEED" == "y" || "$PROCEED" == "Y" ]] || { echo "Aborted." >&2; exit 1; }
  fi
fi

echo "Deploying..."
DEPLOY_OUT=$(az deployment sub create \
  --name "$DEPLOYMENT_NAME" \
  --location "$LOCATION" \
  --template-file "$TEMPLATE_FILE" \
  --parameters "$PARAM_FILE" \
  --parameters sqlAdminPassword="$CEMS_SQL_ADMIN_PASSWORD" \
  --output json)

echo "========================================"
echo "Deployment complete: $DEPLOYMENT_NAME"
echo "========================================"

# Restart App Service to force re-resolution of Key Vault references now that RBAC has propagated.
RG="cems-${ENV}-rg"
API_APP=$(echo "$DEPLOY_OUT" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d['properties']['outputs']['apiAppServiceName']['value'])" 2>/dev/null || echo "")

if [[ -n "$API_APP" ]]; then
  echo "Restarting $API_APP so Key Vault references re-resolve post-RBAC propagation..."
  # Wait for RBAC to propagate (eventually consistent, usually 30-90s)
  sleep 60
  az webapp restart --resource-group "$RG" --name "$API_APP" --output none
  echo "Restart requested. Health endpoint: https://$(echo "$DEPLOY_OUT" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d['properties']['outputs']['apiHostname']['value'])")/api/v1/health"
fi

echo "========================================"
echo "Post-deploy manual steps:"
echo "  1. Populate operator-seeded Key Vault secrets with real values (jwt-secret, jwt-refresh-secret,"
echo "     resend-api-key, claude-api-key, sql-admin-password) — see README"
echo "  2. Verify app settings: az webapp config appsettings list -g $RG -n $API_APP"
echo "  3. Populate swaCorsOrigins in envs/${ENV}/main.bicepparam with the SWA hostnames from deployment output"
echo "     and re-deploy so Storage CORS tightens to just those hostnames"
