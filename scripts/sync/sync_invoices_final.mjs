import fetch from 'node-fetch';
import fs from 'fs';
import { google } from 'googleapis';
import path from 'path';

const auth = new google.auth.GoogleAuth({
    keyFile: path.join(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });
const TARGET_ID = '1tptrFkLwSt2Hc5TR648bUDEXjLZv6mp3N8stX7WUdwY'; // Analytics Core

async function syncInvoices() {
    const tokens = JSON.parse(fs.readFileSync('secrets/amo_tokens.json', 'utf8'));
    const domain = 'reforyou';
    const pipelineId = 10633834;

    console.log('--- SYNCING ACCOUNTING PIPELINE ---');

    const res = await fetch(`https://${domain}.amocrm.ru/api/v4/leads?filter[pipeline_id]=${pipelineId}&limit=250`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });
    const data = await res.json();
    const leads = data._embedded ? data._embedded.leads : [];

    const resultRows = [
        ['Lead_ID', 'Название', 'Статус', 'Брокер', 'Общая Комиссия (AED)', 'Комиссия Брокера (AED)', 'Доход Компании (AED)', 'Тип Кэшфлоу']
    ];

    leads.forEach(l => {
        const getVal = (id) => {
            const f = l.custom_fields_values?.find(cf => cf.field_id === id);
            return f ? f.values[0].value : 0;
        };
        
        const unitPrice = parseFloat(getVal(1343899)) || 0;
        const devCommPct = parseFloat(getVal(1343901)) || 0;
        const totalComm = unitPrice * (devCommPct / 100);
        
        const brokerComm = parseFloat(getVal(1343909)) || 0;
        const netProfit = totalComm - brokerComm;
        const broker = getVal(1343903) || 'Unknown';
        
        let cashflowType = 'Unknown';
        if (l.status_id === 83955706) cashflowType = 'Short-term (~1 month)';
        if (l.status_id === 83827322 || l.status_id === 83827326) cashflowType = 'Long-term (~3 months)';

        let statusName = 'Pending';
        if (l.status_id === 83955706) statusName = 'Инвойс выставлен';
        if (l.status_id === 83827322) statusName = 'Новая сделка';
        if (l.status_id === 83827326) statusName = 'Авансирование';

        if (cashflowType !== 'Unknown') {
            resultRows.push([l.id, l.name, statusName, broker, totalComm, brokerComm, netProfit, cashflowType]);
        }
    });

    // Create Sheet
    try {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: TARGET_ID,
            resource: { requests: [{ addSheet: { properties: { title: 'Global_Invoices_Feed' } } }] }
        });
    } catch (e) {}

    await sheets.spreadsheets.values.clear({ spreadsheetId: TARGET_ID, range: 'Global_Invoices_Feed!A1:Z500' });
    await sheets.spreadsheets.values.update({
        spreadsheetId: TARGET_ID, range: 'Global_Invoices_Feed!A1',
        valueInputOption: 'USER_ENTERED', resource: { values: resultRows },
    });

    console.log('--- SYNC COMPLETE: Global_Invoices_Feed updated ---');
}

syncInvoices().catch(console.error);
