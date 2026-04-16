import fs from 'fs';
import path from 'path';

const AMO_TOKENS_FILE = path.resolve('./secrets/amo_tokens.json');
const domain = 'reforyou.amocrm.ru';

async function getBrokers() {
    if (!fs.existsSync(AMO_TOKENS_FILE)) {
        console.error('Tokens file not found');
        return;
    }
    const tokens = JSON.parse(fs.readFileSync(AMO_TOKENS_FILE, 'utf8'));
    const res = await fetch(`https://${domain}/api/v4/users`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });
    
    if (res.status !== 200) {
        console.error('API Error:', res.status, await res.text());
        return;
    }

    const data = await res.json();
    const users = data._embedded?.users || [];
    console.log('Total users found:', users.length);
    const activeBrokers = users
        .filter(u => !u.name.toLowerCase().includes('admin') && !u.name.toLowerCase().includes('bot') && u.role_id !== 0)
        .map(u => ({ id: u.id, name: u.name }));
    console.log(JSON.stringify(activeBrokers, null, 2));
}

getBrokers().catch(err => {
    console.error('Error fetching brokers:', err);
    process.exit(1);
});
