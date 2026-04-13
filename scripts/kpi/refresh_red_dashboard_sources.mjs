import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const steps = [
    'refresh_amo_token.mjs',
    'sync_amo_channel_leads_raw.mjs',
    'sync_red_to_bq_final.mjs',
    'sync_red_loss_reasons.mjs',
    'create_red_master_view.mjs',
    'create_red_channel_daily.mjs',
    'create_unified_marketing_drilldown_daily.mjs'
];

function runStep(scriptName) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [path.resolve(__dirname, scriptName)], {
            cwd: path.resolve(__dirname, '..', '..'),
            stdio: 'inherit'
        });

        child.on('exit', (code) => {
            if (code === 0) {
                resolve();
                return;
            }

            reject(new Error(`${scriptName} exited with code ${code}`));
        });
    });
}

async function refreshRedDashboardSources() {
    console.log('--- REFRESHING RED DASHBOARD SOURCES ---');

    for (const scriptName of steps) {
        console.log(`\n>>> Running ${scriptName}`);
        await runStep(scriptName);
    }

    console.log('\nSUCCESS: RED dashboard sources are up to date.');
}

refreshRedDashboardSources().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});