#!/usr/bin/env bash
# Run a /var/lib/tcg/<BIN> binary on the production EC2 instance via SSM,
# then poll until it finishes. Streams stdout/stderr on completion or
# failure, and exits non-zero if the SSM command failed or timed out.
#
# Usage:  ssm-run-binary.sh <bin-name> <poll-interval-sec> <max-iterations>
# Env:    INSTANCE_ID, AWS_REGION (set in the calling workflow step)

set -euo pipefail

BIN="${1:?missing binary name}"
INTERVAL="${2:?missing poll interval seconds}"
MAX_ITERS="${3:?missing max iterations}"

: "${INSTANCE_ID:?INSTANCE_ID env var required}"
: "${AWS_REGION:?AWS_REGION env var required}"

# AWS SSM command timeout has to cover the worst-case binary run.
TIMEOUT_SECONDS=$(( INTERVAL * MAX_ITERS ))

COMMAND_ID=$(aws ssm send-command \
  --region "$AWS_REGION" \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --comment "$BIN triggered from refresh-data workflow" \
  --timeout-seconds "$TIMEOUT_SECONDS" \
  --parameters commands='[
    "set -eu",
    "DATABASE_URL=sqlite:/var/lib/tcg/mtg_card_db.db /var/lib/tcg/'"$BIN"'"
  ]' \
  --query "Command.CommandId" \
  --output text)

echo "::group::SSM command ($BIN, id=$COMMAND_ID, max=${MAX_ITERS}x${INTERVAL}s)"

for i in $(seq 1 "$MAX_ITERS"); do
  STATUS=$(aws ssm get-command-invocation \
    --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --query "Status" \
    --output text 2>/dev/null || echo "Pending")

  echo "[$i/$MAX_ITERS] $BIN status: $STATUS"

  case "$STATUS" in
    Success)
      echo "::endgroup::"
      echo "::group::$BIN output"
      aws ssm get-command-invocation \
        --command-id "$COMMAND_ID" \
        --instance-id "$INSTANCE_ID" \
        --query "StandardOutputContent" \
        --output text
      echo "::endgroup::"
      exit 0
      ;;
    Failed|TimedOut|Cancelled)
      echo "::endgroup::"
      echo "::error::$BIN ended with status $STATUS"
      echo "=== STDOUT ==="
      aws ssm get-command-invocation \
        --command-id "$COMMAND_ID" \
        --instance-id "$INSTANCE_ID" \
        --query "StandardOutputContent" \
        --output text
      echo "=== STDERR ==="
      aws ssm get-command-invocation \
        --command-id "$COMMAND_ID" \
        --instance-id "$INSTANCE_ID" \
        --query "StandardErrorContent" \
        --output text
      exit 1
      ;;
  esac

  sleep "$INTERVAL"
done

echo "::endgroup::"
echo "::error::Timed out waiting for $BIN after $((MAX_ITERS * INTERVAL))s"
exit 1
