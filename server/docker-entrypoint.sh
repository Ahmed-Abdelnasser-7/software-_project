#!/usr/bin/env sh
set -eu

SCHEMA_PATH="prisma/prisma/schema.prisma"

# Run database migrations (safe for production-style deploy)
# Assumes DATABASE_URL is set.
if [ -n "${DATABASE_URL:-}" ]; then
  npx prisma migrate deploy --schema "$SCHEMA_PATH"
else
  echo "DATABASE_URL is not set; cannot run migrations." >&2
  exit 1
fi

exec "$@"
