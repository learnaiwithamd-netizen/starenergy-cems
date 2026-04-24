#!/usr/bin/env bash
# deploy.sh — provision a CEMS environment on Azure
# Usage: ./deploy.sh <env>   where env is one of: dev | staging | prod

set -euo pipefail

ENV="${1:-}"
LOCATION="canadacentral"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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

if [[ ! -f "$PARAM_FILE" ]]; then
  echo "Error: parameter file not found: $PARAM_FILE" >&2
  exit 2
fi

if ! command -v az >/dev/null 2>&1; then
  echo "Error: Azure CLI (az) not found on PATH. Install: https://aka.ms/install-azure-cli" >&2
  exit 127
fi

if ! az account show >/dev/null 2>&1; then
  echo "Error: not logged in to Azure. Run 'az login' first." >&2
  exit 1
fi

SUBSCRIPTION_ID=$(az account show --query id -o tsv)
SUBSCRIPTION_NAME=$(az account show --query name -o tsv)

if [[ -z "${CEMS_SQL_ADMIN_PASSWORD:-}" ]]; then
  echo "Error: CEMS_SQL_ADMIN_PASSWORD env var must be set (strong password for SQL server admin)." >&2
  echo "       Example: export CEMS_SQL_ADMIN_PASSWORD='\$(openssl rand -base64 32)'" >&2
  exit 1
fi

echo "========================================"
echo "CEMS Infrastructure Deployment"
echo "========================================"
echo "  Environment:   $ENV"
echo "  Location:      $LOCATION"
echo "  Subscription:  $SUBSCRIPTION_NAME ($SUBSCRIPTION_ID)"
echo "  Template:      $TEMPLATE_FILE"
echo "  Parameters:    $PARAM_FILE"
echo "========================================"

if [[ "$ENV" == "prod" ]]; then
  echo "*** PRODUCTION DEPLOYMENT ***"
  read -rp "Type 'DEPLOY PROD' to proceed: " CONFIRM1
  if [[ "$CONFIRM1" != "DEPLOY PROD" ]]; then
    echo "Aborted." >&2
    exit 1
  fi
  read -rp "Are you sure? Type the subscription id to confirm: " CONFIRM2
  if [[ "$CONFIRM2" != "$SUBSCRIPTION_ID" ]]; then
    echo "Subscription id mismatch — aborted." >&2
    exit 1
  fi
fi

DEPLOYMENT_NAME="cems-${ENV}-$(date +%Y%m%d-%H%M%S)"

echo "Running what-if preview first..."
az deployment sub what-if \
  --name "${DEPLOYMENT_NAME}-whatif" \
  --location "$LOCATION" \
  --template-file "$TEMPLATE_FILE" \
  --parameters "$PARAM_FILE" \
  --parameters sqlAdminPassword="$CEMS_SQL_ADMIN_PASSWORD"

read -rp "Proceed with deployment? [y/N]: " PROCEED
if [[ "$PROCEED" != "y" && "$PROCEED" != "Y" ]]; then
  echo "Aborted." >&2
  exit 1
fi

echo "Deploying..."
az deployment sub create \
  --name "$DEPLOYMENT_NAME" \
  --location "$LOCATION" \
  --template-file "$TEMPLATE_FILE" \
  --parameters "$PARAM_FILE" \
  --parameters sqlAdminPassword="$CEMS_SQL_ADMIN_PASSWORD"

echo "========================================"
echo "Deployment complete: $DEPLOYMENT_NAME"
echo "========================================"
echo "Post-deploy manual steps:"
echo "  1. Populate real secret values in Key Vault (all secrets currently hold REPLACE_ME_* placeholders)"
echo "  2. Grant your developer account 'Key Vault Secrets Officer' role on the kv so you can set secrets"
echo "  3. Verify App Service picks up secrets: az webapp config appsettings list -g cems-${ENV}-rg -n cems-${ENV}-api"
