import fs from 'fs';
import path from 'path';

async function checkIndividualLead() {
    const tokens = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'secrets/amo_tokens.json'), 'utf8'));
    const url = `https://reforyou.amocrm.ru/api/v4/leads?limit=1&with=is_price_modified_by_robot,loss_reason,contacts`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${tokens.access_token}` } });
    const data = await res.json();
    console.log('--- SAMPLE LEAD DATA ---');
    console.log(JSON.stringify(data?._embedded?.leads?.[0], null, 2));
}

checkIndividualLead();
