#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/root/foryou-dashboards-prod"
LOG_DIR="/var/log/pf_to_amo"
REPORT_STDOUT_LOG="$LOG_DIR/report_stdout.log"
AUDIT_LOG="$LOG_DIR/audit.log"

mkdir -p "$LOG_DIR"

log_audit() {
  local msg="$1"
  printf '%s %s\n' "$(date -Iseconds)" "$msg" >> "$AUDIT_LOG"
}

start_ts=$(date +%s)
log_audit "step=telegram_report event=start"

cd "$APP_DIR"
set -a
source ./.env
if [[ -f ./.env.local ]]; then
  source ./.env.local
fi
set +a

set +e
/usr/bin/node scripts/sync/pf_sync_telegram_report.mjs >> "$REPORT_STDOUT_LOG" 2>&1
rc=$?
set -e

end_ts=$(date +%s)
duration=$((end_ts - start_ts))
log_audit "step=telegram_report event=finish rc=$rc duration_sec=$duration"

exit $rc
