#!/bin/zsh
set -euo pipefail

REPO_ROOT="/Users/vytvytskyi/foryou-dashboards"
SOURCE_PLIST="$REPO_ROOT/scripts/sync/plan-fact-sync.launchd.plist"
TARGET_DIR="$HOME/Library/LaunchAgents"
TARGET_PLIST="$TARGET_DIR/com.foryou.plan-fact-sync.plist"
LOG_DIR="$REPO_ROOT/data/logs"
UID_VALUE="$(id -u)"

mkdir -p "$TARGET_DIR"
mkdir -p "$LOG_DIR"
cp "$SOURCE_PLIST" "$TARGET_PLIST"

launchctl bootout "gui/$UID_VALUE" "$TARGET_PLIST" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$UID_VALUE" "$TARGET_PLIST"
launchctl enable "gui/$UID_VALUE/com.foryou.plan-fact-sync"
launchctl kickstart -k "gui/$UID_VALUE/com.foryou.plan-fact-sync"

echo "Installed: $TARGET_PLIST"
echo "Label: com.foryou.plan-fact-sync"
echo "Interval: 1800 seconds"