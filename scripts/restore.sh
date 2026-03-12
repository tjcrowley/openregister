#!/usr/bin/env bash
set -euo pipefail

# OpenRegister PostgreSQL restore script
# Usage: ./scripts/restore.sh [backup_filename]
#
# If backup_filename is not provided, the most recent backup is used.
#
# Required env vars:
#   DATABASE_URL  — PostgreSQL connection URL for the TARGET database
#   S3_BUCKET     — S3 bucket name
#   AWS_REGION    — AWS region (defaults to us-east-1)

DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required}"
S3_BUCKET="${S3_BUCKET:?S3_BUCKET is required}"
AWS_REGION="${AWS_REGION:-us-east-1}"

if [[ $# -ge 1 ]]; then
  BACKUP_FILE="$1"
else
  # Retrieve most recent backup
  BACKUP_FILE=$(aws s3 ls "s3://${S3_BUCKET}/backups/" --region "${AWS_REGION}" | \
    sort | tail -n 1 | awk '{print $4}')
fi

if [[ -z "${BACKUP_FILE}" ]]; then
  echo "[restore] ERROR: No backup file found" >&2
  exit 1
fi

BACKUP_PATH="/tmp/${BACKUP_FILE}"

echo "[restore] Downloading s3://${S3_BUCKET}/backups/${BACKUP_FILE}"

aws s3 cp \
  "s3://${S3_BUCKET}/backups/${BACKUP_FILE}" \
  "${BACKUP_PATH}" \
  --region "${AWS_REGION}"

echo "[restore] Restoring to database…"

pg_restore \
  --no-acl \
  --no-owner \
  --clean \
  --if-exists \
  --dbname="${DATABASE_URL}" \
  "${BACKUP_PATH}"

echo "[restore] Restore complete from ${BACKUP_FILE}"
rm -f "${BACKUP_PATH}"
