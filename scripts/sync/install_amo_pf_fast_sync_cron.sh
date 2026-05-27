#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${1:-/root/foryou-admin-ru}"
CRON_EXPR="${CRON_EXPR:-*/5 * * * *}"
WRAPPER_PATH="$APP_DIR/scripts/sync/amo_pf_fast_sync_cron_wrapper.sh"
CRON_LOG="/var/log/foryou-sync/cron.log"
RUN_NOW="${RUN_NOW:-1}"

if [[ ! -d "$APP_DIR" ]]; then
  echo "APP_DIR does not exist: $APP_DIR" >&2
  exit 1
fi

if [[ ! -f "$WRAPPER_PATH" ]]; then
  echo "Wrapper not found: $WRAPPER_PATH" >&2
  exit 1
fi

chmod +x "$WRAPPER_PATH"
mkdir -p /var/log/foryou-sync

CRON_CMD="cd $APP_DIR && APP_DIR=$APP_DIR /usr/bin/env bash $WRAPPER_PATH >> $CRON_LOG 2>&1"

TMP_FILE="$(mktemp)"
trap 'rm -f "$TMP_FILE"' EXIT

{
  crontab -l 2>/dev/null | grep -v "amo_pf_fast_sync_cron_wrapper.sh" || true
  printf '%s %s\n' "$CRON_EXPR" "$CRON_CMD"
} > "$TMP_FILE"

crontab "$TMP_FILE"

echo "Installed server cron for AMO/PF fast sync"
echo "Schedule: $CRON_EXPR"
echo "Wrapper: $WRAPPER_PATH"
echo "Cron log: $CRON_LOG"

if [[ "$RUN_NOW" == "1" ]]; then
  echo "Running smoke sync now..."
  APP_DIR="$APP_DIR" /usr/bin/env bash "$WRAPPER_PATH"
  echo "Smoke sync finished"
fi