#!/usr/bin/env bash
# sync-swa-tokens.sh — pull Azure Static Web Apps deployment tokens from
# the env's resource group and write them as GitHub repo secrets so the
# `Azure/static-web-apps-deploy@v1` action in the workflows can authenticate.
#
# Usage: infra/scripts/sync-swa-tokens.sh <env>
#
# Prereqs: az login + gh auth login already done.
# CI takes over secret rotation post-MVP; this is a manual one-shot for now.

set -euo pipefail

ENV="${1:?usage: $0 <dev|staging|prod>}"

case "${ENV}" in
  dev|staging|prod) ;;
  *) echo "error: env must be dev|staging|prod, got '${ENV}'" >&2; exit 2 ;;
esac

RG="cems-${ENV}-rg"

case "${ENV}" in
  dev)     SUFFIX='' ;;
  staging) SUFFIX='_STAGING' ;;
  prod)    SUFFIX='_PROD' ;;
esac

AUDIT_NAME="cems-${ENV}-swa-audit"
ADMIN_NAME="cems-${ENV}-swa-admin"
CLIENT_NAME="cems-${ENV}-swa-client"

echo "Pulling SWA tokens from ${RG}..."
AUDIT_TOKEN=$(az staticwebapp secrets list -n "${AUDIT_NAME}" -g "${RG}" --query properties.apiKey -o tsv)
ADMIN_TOKEN=$(az staticwebapp secrets list -n "${ADMIN_NAME}"  -g "${RG}" --query properties.apiKey -o tsv)
CLIENT_TOKEN=$(az staticwebapp secrets list -n "${CLIENT_NAME}" -g "${RG}" --query properties.apiKey -o tsv)

echo "Writing GitHub repo secrets..."
gh secret set "AZURE_SWA_AUDIT_TOKEN${SUFFIX}"  --body "${AUDIT_TOKEN}"
gh secret set "AZURE_SWA_ADMIN_TOKEN${SUFFIX}"  --body "${ADMIN_TOKEN}"
gh secret set "AZURE_SWA_CLIENT_TOKEN${SUFFIX}" --body "${CLIENT_TOKEN}"

echo "Done. Secrets set: AZURE_SWA_{AUDIT,ADMIN,CLIENT}_TOKEN${SUFFIX}"
