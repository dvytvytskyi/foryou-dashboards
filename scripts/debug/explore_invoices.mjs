import fetch from 'node-fetch';
import fs from 'fs';

async function explorePipeline() {
    const tokens = JSON.parse(fs.readFileSync('secrets/amo_tokens.json', 'utf8'));
    const domain = 'reforyou';
    const pipelineId = 10633834;

    console.log(`--- Exploring Pipeline ${pipelineId} ---`);

    // 1. Get Pipeline Stages
    const pipeRes = await fetch(`https://${domain}.amocrm.ru/api/v4/leads/pipelines/${pipelineId}`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });
    const pipeData = await pipeRes.json();
    console.log('Stages:', pipeData._embedded.statuses.map(s => `${s.id}: ${s.name}`));

    // 2. Get Lead Sample to find Custom Fields
    const leadRes = await fetch(`https://${domain}.amocrm.ru/api/v4/leads?filter[pipeline_id]=${pipelineId}&limit=5&with=contact`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });
    const leads = await leadRes.json();
    if (leads._embedded && leads._embedded.leads) {
        console.log('Sample Lead Custom Fields:', JSON.stringify(leads._embedded.leads[0].custom_fields_values, null, 2));
    } else {
        console.log('No leads found in this pipeline yet.');
    }
}

explorePipeline().catch(console.error);
