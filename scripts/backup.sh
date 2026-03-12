#!/usr/bin/env bash
set -euo pipefail

# OpenRegister PostgreSQL backup script
# Usage: ./scripts/backup.sh
#
# Required env vars:
#   DATABASE_URL  — PostgreSQL connection URL
#   S3_BUCKET     — S3 bucket name (e.g. my-backups)
#   AWS_REGION    — AWS region (defaults to us-east-1)

DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required}"
S3_BUCKET="${S3_BUCKET:?S3_BUCKET is required}"
AWS_REGION="${AWS_REGION:-us-east-1}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="openregister_${TIMESTAMP}.pg_dump"
BACKUP_PATH="/tmp/${BACKUP_FILE}"

echo "[backup] Starting backup at ${TIMESTAMP}"

# Dump the database in custom format (most flexible for restore)
pg_dump \
  --format=custom \
  --no-acl \
  --no-owner \
  --compress=9 \
  "${DATABASE_URL}" \
  --file="${BACKUP_PATH}"

echo "[backup] Dump complete: ${BACKUP_PATH}"

# Upload to S3
aws s3 cp \
  "${BACKUP_PATH}" \
  "s3://${S3_BUCKET}/backups/${BACKUP_FILE}" \
  --region "${AWS_REGION}" \
  --sse aws:kms

echo "[backup] Uploaded to s3://${S3_BUCKET}/backups/${BACKUP_FILE}"

# Remove local file
rm -f "${BACKUP_PATH}"

# Prune backups older than 30 days
aws s3 ls "s3://${S3_BUCKET}/backups/" --region "${AWS_REGION}" | \
  awk '{print $4}' | \
  while read -r key; do
    # Extract timestamp from filename
    ts=$(echo "${key}" | grep -oP '\d{8}_\d{6}' || true)
    if [[ -z "${ts}" ]]; then continue; fi
    file_date=$(date -d "${ts:0:8}" +%s 2>/dev/null || date -j -f "%Y%m%d" "${ts:0:8}" +%s 2>/dev/null || echo 0)
    cutoff=$(date -d "30 days ago" +%s 2>/dev/null || date -v-30d +%s 2>/dev/null || echo 0)
    if [[ "${file_date}" -lt "${cutoff}" ]]; then
      echo "[backup] Pruning old backup: ${key}"
      aws s3 rm "s3://${S3_BUCKET}/backups/${key}" --region "${AWS_REGION}"
    fi
  done

echo "[backup] Done"
