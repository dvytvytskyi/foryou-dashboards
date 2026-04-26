import fs from 'fs';

// Load .env file manually
const envContent = fs.readFileSync('.env', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const tokens = JSON.parse(fs.readFileSync('secrets/amo_tokens.json', 'utf8'));
const clientId = envVars.AMO_CLIENT_ID;
const clientSecret = envVars.AMO_CLIENT_SECRET;

console.log('Client ID:', clientId);
console.log('Client Secret:', clientSecret ? clientSecret.substring(0, 10) + '***' : 'MISSING');

if (!clientId || !clientSecret) {
  console.error('Missing AMO_CLIENT_ID or AMO_CLIENT_SECRET in .env');
  process.exit(1);
}

(async () => {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token
  });

  const res = await fetch('https://reforyou.amocrm.ru/oauth2/access_token', {
    method: 'POST',
    body: body.toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  console.log('Refresh status:', res.status);
  const data = await res.json();
  
  if (res.ok) {
    console.log('New token expires in:', data.expires_in, 'seconds');
    console.log('Server time:', data.server_time);
    
    // Save new token
    fs.writeFileSync('secrets/amo_tokens.json', JSON.stringify(data, null, 2));
    console.log('✓ Token updated');
  } else {
    console.log('Error refreshing:', JSON.stringify(data, null, 2));
  }
})().catch(console.error);
