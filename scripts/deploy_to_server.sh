#!/bin/bash

# SERVER CONFIG
SERVER_IP="135.181.201.185"
TARGET_DIR="/root/amo-sync"

echo "--- 🚀 Initializing Server Deployment ---"

# 1. Create directory on server
ssh root@$SERVER_IP "mkdir -p $TARGET_DIR"

# 2. Copy files (You will need to enter your password for each command)
echo "--- 📦 Copying files to server... ---"
scp package.json secrets/crypto-world-epta-2db29829d55d.json secrets/amo_tokens.json sync_total.mjs root@$SERVER_IP:$TARGET_DIR/

# 3. Remote Setup (Install Node and Cron)
echo "--- 🛠️  Running server-side setup... ---"
ssh root@$SERVER_IP "cd $TARGET_DIR && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    npm install && \
    (crontab -l 2>/dev/null; echo '*/30 * * * * cd $TARGET_DIR && /usr/bin/node sync_total.mjs >> $TARGET_DIR/sync.log 2>&1') | crontab -"

echo "--- ✅ DEPLOYMENT FINISHED! ---"
echo "Script is now on the server and will run every 30 minutes."
