#!/usr/bin/env bash
# check-calc-schemas.sh — local drift check against the calc-service.
# Runs the calc-service in-process via Python (no docker / no port conflict)
# to dump the OpenAPI spec, then compares against the Zod mirrors. Exits
# non-zero on drift so it works as a pre-commit hook.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OPENAPI_PATH="${REPO_ROOT}/.tmp/calc-openapi.json"
ZOD_PATH="${REPO_ROOT}/apps/api/src/lib/calc-service-schemas.ts"

mkdir -p "$(dirname "${OPENAPI_PATH}")"

# Resolve a Python that has fastapi installed (anaconda envs commonly do).
PYTHON_BIN="${PYTHON_BIN:-}"
if [[ -z "${PYTHON_BIN}" ]]; then
  for cand in python3 /opt/anaconda3/bin/python3 python; do
    if "$cand" -c 'import fastapi' >/dev/null 2>&1; then
      PYTHON_BIN="$cand"
      break
    fi
  done
fi

if [[ -z "${PYTHON_BIN}" ]]; then
  echo "error: no Python with fastapi installed found on PATH. Set PYTHON_BIN env var." >&2
  exit 127
fi

(
  cd "${REPO_ROOT}/apps/calc-service"
  "${PYTHON_BIN}" -c 'import json; from app.main import app; print(json.dumps(app.openapi()))'
) > "${OPENAPI_PATH}"

node "${REPO_ROOT}/scripts/compare-zod-shape.mjs" "${OPENAPI_PATH}" "${ZOD_PATH}"
