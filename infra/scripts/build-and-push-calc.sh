#!/usr/bin/env bash
# build-and-push-calc.sh — bootstrap script to build the calc-service image
# and push it to the env-specific Azure Container Registry.
#
# Usage: infra/scripts/build-and-push-calc.sh <env> [tag]
#   env  — dev | staging | prod
#   tag  — optional image tag (defaults to "latest")
#
# Requires: az login already done; docker daemon running on host.
# CI takes over this responsibility in Story 0.6 (GitHub Actions on PR merge).

set -euo pipefail

ENV="${1:?usage: $0 <env> [tag]}"
TAG="${2:-latest}"

case "${ENV}" in
  dev|staging|prod) ;;
  *) echo "error: env must be one of dev|staging|prod, got '${ENV}'" >&2; exit 2 ;;
esac

REGISTRY_NAME="cemsacr${ENV}"
REGISTRY="${REGISTRY_NAME}.azurecr.io"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONTEXT="${REPO_ROOT}/apps/calc-service"

echo "Logging into ${REGISTRY_NAME}..."
az acr login --name "${REGISTRY_NAME}"

echo "Building calc-service image (linux/amd64)..."
docker build \
  --platform=linux/amd64 \
  -t "${REGISTRY}/calc-service:${TAG}" \
  "${CONTEXT}"

echo "Pushing to ${REGISTRY}/calc-service:${TAG}..."
docker push "${REGISTRY}/calc-service:${TAG}"

echo "Pushed ${REGISTRY}/calc-service:${TAG}"
echo "Next: redeploy Container App so it pulls the new image (./deploy.sh ${ENV})."
