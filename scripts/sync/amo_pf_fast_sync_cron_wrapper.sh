#!/usr/bin/env bash
set -euo pipefail

APP_DIR_NEW="/root/foryou-admin-ru"
APP_DIR_OLD="/root/foryou-dashboards-prod"
APP_DIR="${APP_DIR:-}"

if [[ -z "$APP_DIR" ]]; then
  if [[ -d "$APP_DIR_NEW" ]]; then
    APP_DIR="$APP_DIR_NEW"
  else
    APP_DIR="$APP_DIR_OLD"
  fi
fi

LOG_DIR="/var/log/foryou-sync"
SYNC_STDOUT_LOG="$LOG_DIR/amo_pf_fast_sync_stdout.log"
AUDIT_LOG="$LOG_DIR/amo_pf_fast_sync_audit.log"
LOCK_FILE="/tmp/amo_pf_fast_sync.lock"
SERVICE_NAME="${SERVICE_NAME:-app}"
RUN_OPTIONAL_STEPS="${RUN_OPTIONAL_STEPS:-0}"

mkdir -p "$LOG_DIR"

log_audit() {
  local msg="$1"
  printf '%s %s\n' "$(date -Iseconds)" "$msg" >> "$AUDIT_LOG"
}

NODE_BIN="${NODE_BIN:-$(command -v node || true)}"
if [[ -z "$NODE_BIN" ]]; then
  NODE_BIN="/usr/bin/node"
fi
CONTAINER_NODE_BIN="${CONTAINER_NODE_BIN:-node}"

if command -v docker >/dev/null 2>&1; then
  if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
  else
    COMPOSE_CMD=""
  fi
else
  COMPOSE_CMD=""
fi

run_step() {
  local step="$1"
  local cmd="$2"

  local start_ts end_ts rc duration
  start_ts=$(date +%s)
  log_audit "step=$step event=start"

  set +e
  eval "$cmd" >> "$SYNC_STDOUT_LOG" 2>&1
  rc=$?
  set -e

  end_ts=$(date +%s)
  duration=$((end_ts - start_ts))

  log_audit "step=$step event=finish rc=$rc duration_sec=$duration"
  return $rc
}

run_optional_step() {
  local step="$1"
  local cmd="$2"

  if ! run_step "$step" "$cmd"; then
    # KPI steps are best-effort and must not interrupt PF->AMO ingestion.
    log_audit "step=$step event=non_blocking_failure"
  fi
}

run_in_app() {
  local script_path="$1"
  if [[ -n "$COMPOSE_CMD" ]]; then
    bash -lc "$COMPOSE_CMD exec -T $SERVICE_NAME $CONTAINER_NODE_BIN $script_path"
  else
    if [[ ! -x "$NODE_BIN" ]]; then
      log_audit "event=error reason=node_not_found"
      return 127
    fi
    bash -lc "$NODE_BIN $script_path"
  fi
}

main() {
  if [[ ! -d "$APP_DIR" ]]; then
    log_audit "event=error reason=app_dir_missing app_dir=$APP_DIR"
    exit 1
  fi

  if [[ ! -f "$APP_DIR/.env" ]]; then
    log_audit "event=error reason=env_missing path=$APP_DIR/.env"
    exit 1
  fi

  cd "$APP_DIR"
  set -a
  source ./.env
  if [[ -f ./.env.local ]]; then
    source ./.env.local
  fi
  set +a

  run_step "sync_pf_to_postgres" "run_in_app scripts/sync/sync_pf_to_postgres.mjs"
  run_step "sync_pf_to_amo" "run_in_app scripts/sync/sync_pf_to_amo.mjs"

  if [[ "$RUN_OPTIONAL_STEPS" == "1" ]]; then
    run_optional_step "sync_pf_amo_project_match" "run_in_app scripts/kpi/sync_pf_amo_project_match.mjs"
    run_optional_step "sync_amo_channel_leads_raw" "run_in_app scripts/kpi/sync_amo_channel_leads_raw.mjs"
  else
    log_audit "event=optional_steps_skipped reason=disabled"
  fi
}

if command -v flock >/dev/null 2>&1; then
  exec 9>"$LOCK_FILE"
  if ! flock -n 9; then
    log_audit "event=skipped reason=lock_active"
    exit 0
  fi
fi

main
