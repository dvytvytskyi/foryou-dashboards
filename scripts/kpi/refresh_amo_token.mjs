import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve('./.env') });

const AMO_TOKENS_FILE = path.resolve('./secrets/amo_tokens.json');
const domain = process.env.AMO_DOMAIN || 'reforyou.amocrm.ru';

async function isAccessTokenValid(accessToken) {
    if (!accessToken) return false;

    const res = await fetch(`https://${domain}/api/v4/account`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });

    return res.ok;
}

async function refreshToken() {
    console.log('--- REFRESHING AMO TOKENS ---');
    if (!fs.existsSync(AMO_TOKENS_FILE)) return;
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));

    if (!tokens.refresh_token) {
        const valid = await isAccessTokenValid(tokens.access_token);
        if (valid) {
            console.log('No refresh_token found; existing access token is valid, skipping refresh.');
            return;
        }

        console.error('REFRESH FAILED: no refresh_token and current access_token is invalid.');
        process.exit(1);
    }

    const body = {
        client_id: process.env.AMO_CLIENT_ID,
        client_secret: process.env.AMO_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
        redirect_uri: process.env.AMO_REDIRECT_URI
    };

    const res = await fetch(`https://${domain}/oauth2/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (res.ok) {
        const newTokens = await res.json();
        // Add server time for checking later
        newTokens.server_time = Math.floor(Date.now() / 1000);
        fs.writeFileSync(AMO_TOKENS_FILE, JSON.stringify(newTokens, null, 2));
        console.log('SUCCESS! Tokens refreshed.');
    } else {
        const err = await res.text();
        console.error('REFRESH FAILED:', res.status, err);

        const fallbackValid = await isAccessTokenValid(tokens.access_token);
        if (fallbackValid) {
            console.warn('Refresh failed, but existing access token is still valid. Continuing.');
            return;
        }

        process.exit(1);
    }
}

refreshToken().catch((err) => {
    console.error(err);
    process.exit(1);
});
