#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/root/foryou-dashboards-prod"
LOG_DIR="/var/log/pf_to_amo"
SYNC_STDOUT_LOG="$LOG_DIR/sync_stdout.log"
AUDIT_LOG="$LOG_DIR/audit.log"

mkdir -p "$LOG_DIR"

log_audit() {
  local msg="$1"
  printf '%s %s\n' "$(date -Iseconds)" "$msg" >> "$AUDIT_LOG"
}

run_step() {
  local step="$1"
  local cmd="$2"
  local out_log="$3"

  local start_ts end_ts rc duration
  start_ts=$(date +%s)
  log_audit "step=$step event=start"

  set +e
  bash -lc "$cmd" >> "$out_log" 2>&1
  rc=$?
  set -e

  end_ts=$(date +%s)
  duration=$((end_ts - start_ts))

  log_audit "step=$step event=finish rc=$rc duration_sec=$duration"
  return $rc
}

cd "$APP_DIR"
set -a
source ./.env
if [[ -f ./.env.local ]]; then
  source ./.env.local
fi
set +a

run_step "sync_pf_to_amo" "/usr/bin/node scripts/sync/sync_pf_to_amo.mjs" "$SYNC_STDOUT_LOG"
