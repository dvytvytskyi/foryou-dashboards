
import fs from 'fs';
import path from 'path';

async function checkContactFields() {
    const tokensPath = path.join(process.cwd(), 'secrets/amo_tokens.json');
    const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
    const domain = 'reforyou.amocrm.ru';

    const contactId = '36470863';
    const url = `https://${domain}/api/v4/contacts/${contactId}`;
    
    const res = await fetch(url, {
        headers: { 'Authorization': 'Bearer ' + tokens.access_token }
    });

    const contact = await res.json();
    console.log('Contact Custom Fields:');
    contact.custom_fields_values?.forEach(f => {
        console.log(`ID: ${f.field_id}, Name: ${f.field_name}, Values: ${f.values.map(v => v.value).join(', ')}`);
    });
}

checkContactFields();
