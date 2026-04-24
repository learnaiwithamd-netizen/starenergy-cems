#!/usr/bin/env bash
# init-dev-db.sh — create the `cems_dev` database inside the running local SQL Server container
# Prerequisites: docker compose up -d sql  (container `cems-sql` must be healthy)

set -euo pipefail

CONTAINER="${CEMS_SQL_CONTAINER:-cems-sql}"
DB_NAME="${CEMS_DB_NAME:-cems_dev}"

# Password comes from env only — no default baked in.
: "${CEMS_SQL_SA_PASSWORD:?CEMS_SQL_SA_PASSWORD env var must be set (same value used by docker-compose.yaml)}"

if ! docker ps --filter "name=^${CONTAINER}$" --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "Error: container '${CONTAINER}' is not running. Start with: docker compose up -d sql" >&2
  exit 1
fi

echo "Waiting for SQL Server to accept connections..."
for i in $(seq 1 40); do
  if docker exec -e MSSQL_SA_PASSWORD="$CEMS_SQL_SA_PASSWORD" "$CONTAINER" \
      /opt/mssql-tools18/bin/sqlcmd -S localhost -U SA -P "$CEMS_SQL_SA_PASSWORD" -C -Q "SELECT 1" >/dev/null 2>&1; then
    echo "SQL Server is up."
    break
  fi
  if [[ "$i" == "40" ]]; then
    echo "Error: SQL Server did not accept connections after 2 minutes." >&2
    exit 1
  fi
  sleep 3
done

echo "Creating database '${DB_NAME}' if it does not exist..."
docker exec "$CONTAINER" /opt/mssql-tools18/bin/sqlcmd -S localhost -U SA -P "$CEMS_SQL_SA_PASSWORD" -C -Q \
  "IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = N'${DB_NAME}') CREATE DATABASE [${DB_NAME}];"

echo "Done. Set DATABASE_URL for Prisma via packages/db/.env (see .env.example)."
