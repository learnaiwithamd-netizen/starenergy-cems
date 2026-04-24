#!/usr/bin/env bash
# init-dev-db.sh — create the `cems_dev` database inside the running local SQL Server container
# Prerequisites: docker compose up -d sql  (container `cems-sql` must be healthy)

set -euo pipefail

CONTAINER="${CEMS_SQL_CONTAINER:-cems-sql}"
SA_PASSWORD="${MSSQL_SA_PASSWORD:-Your_strong_pw_123}"
DB_NAME="${CEMS_DB_NAME:-cems_dev}"

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}\$"; then
  echo "Error: container '${CONTAINER}' is not running. Start with: docker compose up -d sql" >&2
  exit 1
fi

echo "Waiting for SQL Server to accept connections..."
for i in {1..20}; do
  if docker exec "$CONTAINER" /opt/mssql-tools18/bin/sqlcmd -S localhost -U SA -P "$SA_PASSWORD" -C -Q "SELECT 1" >/dev/null 2>&1; then
    echo "SQL Server is up."
    break
  fi
  sleep 3
done

echo "Creating database '${DB_NAME}' if it does not exist..."
docker exec "$CONTAINER" /opt/mssql-tools18/bin/sqlcmd -S localhost -U SA -P "$SA_PASSWORD" -C -Q \
  "IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = N'${DB_NAME}') CREATE DATABASE [${DB_NAME}];"

echo "Done. DATABASE_URL for Prisma:"
echo "  sqlserver://localhost:1433;database=${DB_NAME};user=SA;password=${SA_PASSWORD};trustServerCertificate=true;encrypt=true"
