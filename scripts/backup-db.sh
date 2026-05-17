#!/bin/bash
set -euo pipefail
DB=/var/lib/tcg/mtg_card_db.db
TS=$(date -u +%Y-%m-%dT%H-%M-%SZ)
TMP=/var/lib/tcg/backups/backup_${TS}.db
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
BUCKET=tcg-db-backups-${ACCOUNT}
sqlite3 "$DB" ".backup $TMP"
aws s3 cp "$TMP" "s3://${BUCKET}/daily/${TS}.db"
rm -f "$TMP"
echo "Backup uploaded: s3://${BUCKET}/daily/${TS}.db"
