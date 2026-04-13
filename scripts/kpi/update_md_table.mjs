import fs from 'fs';
import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: path.resolve('./secrets/crypto-world-epta-2db29829d55d.json')
});

async function updateMdTable() {
    try {
        const query = `
          SELECT 
            reference, 
            dashboard_label
          FROM \`crypto-world-epta.foryou_analytics.pf_listings\`
          ORDER BY dashboard_label, reference ASC
        `;
        const [rows] = await bq.query({ query });

        let md = '# Property Finder Listings Table\n\n| Listings | Budget (AED) |\n| :--- | :--- |\n| **Property Finder** | **47,775** |\n';
        
        const categories = {
            'Sell': [],
            'Rent': [],
            'Commercial Sell': [],
            'Commercial Rent': []
        };
        
        rows.forEach(r => {
            if (categories[r.dashboard_label]) categories[r.dashboard_label].push(r);
        });

        for (const [name, items] of Object.entries(categories)) {
            md += `| &nbsp;&nbsp;📂 **${name}** | **-** |\n`;
            items.forEach(i => {
                md += `| &nbsp;&nbsp;&nbsp;&nbsp;↳ \`${i.reference}\` | - |\n`;
            });
        }

        fs.writeFileSync(path.resolve('./PROPERTY_FINDER_TABLE.md'), md);
        console.log('PROPERTY_FINDER_TABLE.md restored and cleaned (no Titles, no Budget data).');

    } catch (e) {
        console.error('Restore failed:', e.message);
    }
}

updateMdTable();
