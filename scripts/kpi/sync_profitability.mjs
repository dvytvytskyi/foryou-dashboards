import { google } from 'googleapis';
import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const FINANCE_SPREADSHEET_ID = '1Iq9EWnd6IP8qsl3vKQOBXpvwSw-_swBLNNI3MPipGqg';
const SERVICE_ACCOUNT_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: SERVICE_ACCOUNT_FILE
});

const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
});

const sheets = google.sheets({ version: 'v4', auth });

async function syncDetailedExpenses() {
    console.log('--- CORRECTED SYNC OF EXPENSES ---');
    
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: FINANCE_SPREADSHEET_ID,
        range: 'ФЕВРАЛЬ 26!E1:J45'
    });

    const rows = res.data.values;
    if (!rows) return;

    const expenses = [];
    const getVal = (r, c) => parseFloat(rows[r-1]?.[c-1]?.toString().replace(/[^0-9.]/g, '')) || 0;

    // Salaries -> Shared (General)
    for(let i=3; i<=18; i++) {
        const amt = getVal(i, 6);
        if (amt > 0) expenses.push({ date: '2026-02-01', category: 'Salary', item: rows[i-1]?.[4] || 'Unknown', amount: amt, allocation: 'General' });
    }
    // Bases -> Вторичка (Matches CRM exactly)
    for(let i=20; i<=24; i++) {
        const amt = getVal(i, 6);
        if (amt > 0) expenses.push({ date: '2026-02-01', category: 'Bases', item: rows[i-1]?.[4] || 'Unknown', amount: amt, allocation: 'Вторичка' });
    }
    // Advertising -> Первичка (Matches CRM exactly)
    for(let i=27; i<=31; i++) {
        const amt = getVal(i, 6);
        if (amt > 0) expenses.push({ date: '2026-02-01', category: 'Ads', item: rows[i-1]?.[4] || 'Unknown', amount: amt, allocation: 'Первичка' });
    }
    // Maintenance -> General (Shared)
    for(let i=34; i<=41; i++) {
        const amt = getVal(i, 6);
        if (amt > 0) expenses.push({ date: '2026-02-01', category: 'Maintenance', item: rows[i-1]?.[4] || 'Unknown', amount: amt, allocation: 'General' });
    }

    const tableId = 'detailed_expenses_mapped';
    const dataset = bq.dataset('foryou_analytics');
    const table = dataset.table(tableId);

    // 1. Create table if NOT exists
    const [exists] = await table.exists();
    if (!exists) {
        console.log('Creating expenses table...');
        await dataset.createTable(tableId, {
            schema: [
                { name: 'date', type: 'DATE' },
                { name: 'category', type: 'STRING' },
                { name: 'item', type: 'STRING' },
                { name: 'amount', type: 'FLOAT' },
                { name: 'allocation', type: 'STRING' }
            ]
        });
        await new Promise(r => setTimeout(r, 2000));
    } else {
        // 2. Clear old data for current month if exists
        await bq.query(`DELETE FROM \`crypto-world-epta.foryou_analytics.${tableId}\` WHERE date = "2026-02-01"`);
    }

    console.log(`Inserting ${expenses.length} records...`);
    await table.insert(expenses);

    // 3. Create Profitability View
    const profitabilityQuery = `
        CREATE OR REPLACE VIEW \`crypto-world-epta.foryou_analytics.department_profitability\` AS
        WITH dept_revenue AS (
          SELECT 
            CAST(date AS DATE) as date,
            department,
            SUM(income) as dept_income,
            SUM(SUM(income)) OVER(PARTITION BY CAST(date AS DATE)) as total_company_income
          FROM \`crypto-world-epta.foryou_analytics.department_performance_all\`
          GROUP BY 1, 2
        ),
        direct_costs AS (
          SELECT date, allocation as department, SUM(amount) as direct_cost
          FROM \`crypto-world-epta.foryou_analytics.detailed_expenses_mapped\`
          WHERE allocation NOT IN ('General')
          GROUP BY 1, 2
        ),
        shared_costs AS (
          SELECT date, SUM(amount) as total_shared_cost
          FROM \`crypto-world-epta.foryou_analytics.detailed_expenses_mapped\`
          WHERE allocation = 'General'
          GROUP BY 1
        )
        SELECT 
          r.date, r.department, r.dept_income as income,
          COALESCE(d.direct_cost, 0) as direct_expenses,
          (COALESCE(s.total_shared_cost, 0) * (SAFE_DIVIDE(r.dept_income, r.total_company_income))) as overhead_expenses,
          COALESCE(d.direct_cost, 0) + (COALESCE(s.total_shared_cost, 0) * (SAFE_DIVIDE(r.dept_income, r.total_company_income))) as total_expenses,
          r.dept_income - (COALESCE(d.direct_cost, 0) + (COALESCE(s.total_shared_cost, 0) * (SAFE_DIVIDE(r.dept_income, r.total_company_income)))) as net_profit
        FROM dept_revenue r
        LEFT JOIN direct_costs d ON r.date = d.date AND r.department = d.department
        LEFT JOIN shared_costs s ON r.date = s.date
    `;

    await bq.query(profitabilityQuery);
    console.log('SUCCESS: Department Profitability synced.');
}

syncDetailedExpenses().catch(console.error);
