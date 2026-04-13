
import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';

const conn = new Client();
const SERVER_CONFIG = {
  host: '135.181.201.185',
  port: 22,
  username: 'root',
  password: 'xTVvPEwrpaF4'
};

const REMOTE_DIR = '/root/amo-sync';
const FILES_TO_UPLOAD = [
    'sync_total.mjs',
    'secrets/amo_tokens.json',
    'secrets/crypto-world-epta-2db29829d55d.json',
    'package.json'
];

console.log('--- 🤖 Deployment Robot Initialized ---');

conn.on('ready', () => {
  console.log('--- 🛡️ SSH Connection Established ---');
  
  conn.sftp((err, sftp) => {
    if (err) throw err;
    
    // 1. Create Remote Dir
    console.log('Creating remote directory...');
    conn.exec(`mkdir -p ${REMOTE_DIR}`, (err, stream) => {
        if (err) throw err;
        stream.on('close', async () => {
            
            // 2. Upload Files
            console.log('Uploading packages...');
            for (const file of FILES_TO_UPLOAD) {
                const localPath = path.join(process.cwd(), file);
                const remotePath = path.join(REMOTE_DIR, file);
                await new Promise((res, rej) => {
                    sftp.fastPut(localPath, remotePath, (err) => {
                        if (err) rej(err);
                        else { console.log(`  Uploaded: ${file}`); res(); }
                    });
                });
            }

            // 3. Setup Server Environment
            console.log('--- 🛠️  Configuring Server Environment ---');
            const setupCmd = `
                cd ${REMOTE_DIR} && \
                if ! command -v node > /dev/null; then
                    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
                    apt-get install -y nodejs
                fi && \
                npm install && \
                (crontab -l 2>/dev/null | grep -v "sync_total.mjs"; echo "*/30 * * * * /usr/bin/node ${REMOTE_DIR}/sync_total.mjs >> ${REMOTE_DIR}/sync.log 2>&1") | crontab -
            `;
            
            conn.exec(setupCmd, (err, stream) => {
                if (err) throw err;
                stream.on('data', (data) => process.stdout.write(data.toString()));
                stream.stderr.on('data', (data) => process.stderr.write(data.toString()));
                stream.on('close', () => {
                    console.log('\n--- ✅ DEPLOYMENT COMPLETE! SERVER IS LIVE ---');
                    conn.end();
                });
            });
        });
    });
  });
}).connect(SERVER_CONFIG);
