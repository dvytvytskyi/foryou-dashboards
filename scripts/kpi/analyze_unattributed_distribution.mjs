import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';
import ExcelJS from 'exceljs';

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: path.resolve(process.cwd(), 'secrets/crypto-world-epta-2db29829d55d.json')
});

async function analyzeDistribution() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('Property_Finder_Source.xlsx');
    
    const brokerToGroup = {}; // Name -> 'Our' | 'Partner'
    
    const getColor = (cell) => {
        const fill = cell.fill;
        if (!fill || !fill.fgColor) return 'NONE';
        return fill.fgColor.argb || 'NONE';
    };

    const colorMap = (color) => {
        if (color === 'FF00FF00' || color === 'FF92D050' || color === 'FF00B050') return 'Partner';
        if (color === 'FFFFFF00' || color === 'FFFFFF00') return 'Our'; // Yellow
        if (['FFD5A6BD', 'FFC27BA0', 'FFEAD1DC'].includes(color)) return 'Partner'; // Pink
        return 'Our'; // Default to Our for others (Red/Blue)
    };

    ['PFKRIS', 'PFYANA'].forEach(s => {
        const sheet = workbook.getWorksheet(s);
        sheet.eachRow((row, i) => {
            if (i === 1) return;
            const color = getColor(row.getCell(2));
            const group = colorMap(color);
            const broker = row.getCell(7).value;
            if (broker && typeof broker === 'string') {
                const b = broker.trim();
                if (!brokerToGroup[b]) brokerToGroup[b] = group;
            }
        });
    });

    const query = `
        SELECT 
            responsible_user, 
            COUNT(*) as count
        FROM \`crypto-world-epta.foryou_analytics.amo_channel_leads_raw\`
        WHERE source_label = 'Property finder'
        AND lead_id NOT IN (
            SELECT DISTINCT CAST(crm_lead_id AS INT64) 
            FROM \`crypto-world-epta.foryou_analytics.pf_efficacy_master\`
            WHERE crm_lead_id IS NOT NULL
        )
        AND created_at >= '2024-01-01' -- Matching user filter
        GROUP BY 1
        ORDER BY 2 DESC
    `;
    
    const [bqRows] = await bq.query(query);
    
    let ourTotal = 0;
    let partnerTotal = 0;
    let unknownTotal = 0;
    
    console.log('--- DISTRIBUTION OF UNATTRIBUTED LEADS BY BROKER ---');
    bqRows.forEach(r => {
        const broker = r.responsible_user;
        const group = brokerToGroup[broker] || 'Unknown';
        if (group === 'Our') ourTotal += Number(r.count);
        else if (group === 'Partner') partnerTotal += Number(r.count);
        else unknownTotal += Number(r.count);
        
        console.log(`${broker.padEnd(25)} | Leads: ${String(r.count).padEnd(5)} | Group: ${group}`);
    });
    
    console.log('\n--- TOTALS BY INFERRED GROUP ---');
    console.log(`Our Leads:     ${ourTotal}`);
    console.log(`Partner Leads: ${partnerTotal}`);
    console.log(`Unknown:       ${unknownTotal}`);
}

analyzeDistribution().catch(console.error);
