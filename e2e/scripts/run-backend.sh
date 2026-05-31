#!/usr/bin/env bash
#
# Seed a throwaway SQLite DB and run the backend against it, so e2e runs never
# touch any tracked DB. Used by playwright.config.ts as the backend webServer.
#
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
DB="$ROOT/e2e/.tmp/e2e.db"

# Build the disposable DB from the version-controlled seed (no tracked blob).
python3 "$HERE/seed_db.py" "$DB"

cd "$ROOT/backend-rust"
export DATABASE_URL="sqlite:$DB"
export JWT_SECRET="${JWT_SECRET:-e2e-test-secret}"
export RUST_LOG="${RUST_LOG:-tcg_backend=warn}"

exec cargo run --bin tcg-backend
