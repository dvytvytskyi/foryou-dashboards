const fs = require('fs');
const path = require('path');

const refreshTokens = async () => {
    const tokensPath = path.join(process.cwd(), 'secrets/amo_tokens.json');
    const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));

    const clientId = process.env.AMO_CLIENT_ID;
    const clientSecret = process.env.AMO_CLIENT_SECRET;
    const redirectUri = process.env.AMO_REDIRECT_URI;
    const domain = process.env.AMO_DOMAIN || 'reforyou.amocrm.ru';

    if (!clientId || !clientSecret || !redirectUri) {
        console.error('Missing AMO env vars: AMO_CLIENT_ID / AMO_CLIENT_SECRET / AMO_REDIRECT_URI');
        process.exit(1);
    }

    console.log('Refreshing token...');

    const res = await fetch(`https://${domain}/oauth2/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'refresh_token',
            refresh_token: tokens.refresh_token,
            redirect_uri: redirectUri
        })
    });

    if (!res.ok) {
        const err = await res.text();
        console.error('Failed to refresh tokens:', err);
        return;
    }

    const newTokens = await res.json();
    newTokens.server_time = Math.floor(Date.now() / 1000);
    fs.writeFileSync(tokensPath, JSON.stringify(newTokens, null, 2));
    console.log('Tokens refreshed successfully!');
};

refreshTokens();
