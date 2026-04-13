import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const bq = new BigQuery({
    projectId: 'crypto-world-epta',
    keyFilename: path.resolve('./secrets/crypto-world-epta-2db29829d55d.json')
});

async function updateRoiView() {
    console.log('--- UPDATING ROI BY CHANNEL VIEW ---');
    
    const query = `
        CREATE OR REPLACE VIEW \`crypto-world-epta.foryou_analytics.department_performance_all\` AS
        SELECT 
          date,
          department,
          broker_name,
          COALESCE(net_company_income, 0) as income,
          COALESCE(gross_commission, 0) as revenue, -- NEW COLUMN
          1 as deals_count,
          -- Let's assume we have source mapping somewhere or we'll add it
          'Unknown' as source 
        FROM \`crypto-world-epta.foryou_analytics.historical_financials\`
    `;

    await bq.query(query);
    console.log('SUCCESS: ROI View updated with Revenue column.');
}

updateRoiView().catch(console.error);
