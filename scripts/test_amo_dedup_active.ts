import { amoFetchJson } from '../src/lib/amo';

async function main() {
  const testPhone = '+971888888888';
  const pipelineId = 10761794;
  const userId = 10688694; // Dima

  console.log('1. Creating Primary Contact A...');
  const createA = await amoFetchJson<any>('api/v4/contacts', {
    method: 'POST',
    body: JSON.stringify([{
      name: 'Primary Contact A',
      responsible_user_id: userId,
      custom_fields_values: [{ field_code: 'PHONE', values: [{ value: testPhone }] }]
    }])
  });
  const contactAId = createA._embedded.contacts[0].id;
  console.log(`Created Primary Contact: ${contactAId}`);

  console.log('2. Creating ACTIVE Lead A for Primary Contact...');
  const createLeadA = await amoFetchJson<any>('api/v4/leads', {
    method: 'POST',
    body: JSON.stringify([{
      name: 'Active Lead A',
      pipeline_id: pipelineId,
      responsible_user_id: userId,
      _embedded: { contacts: [{ id: contactAId }] }
    }])
  });
  const leadAId = createLeadA._embedded.leads[0].id;
  console.log(`Created Active Lead A: ${leadAId}`);

  console.log('3. Creating Duplicate Contact B...');
  const createB = await amoFetchJson<any>('api/v4/contacts', {
    method: 'POST',
    body: JSON.stringify([{
      name: 'FB Lead (Duplicate)',
      responsible_user_id: userId,
      custom_fields_values: [{ field_code: 'PHONE', values: [{ value: testPhone }] }]
    }])
  });
  const contactBId = createB._embedded.contacts[0].id;
  console.log(`Created Duplicate Contact B: ${contactBId}`);

  console.log('4. Creating New Lead B for Duplicate Contact...');
  const createLeadB = await amoFetchJson<any>('api/v4/leads', {
    method: 'POST',
    body: JSON.stringify([{
      name: 'New FB Lead',
      pipeline_id: pipelineId,
      responsible_user_id: userId,
      _embedded: { contacts: [{ id: contactBId }] }
    }])
  });
  const leadBId = createLeadB._embedded.leads[0].id;
  console.log(`Created New Lead B: ${leadBId}`);

  console.log('\n--- Waiting 3 seconds for AmoCRM ---');
  await new Promise(r => setTimeout(r, 3000));

  console.log('\n--- SIMULATING WEBHOOK CALL locally ---');
  // I will make a POST to the local Next.js dev server, BUT since it might not have tokens,
  // I will just use fetch to localhost:3000
  try {
      const res = await fetch('http://localhost:3001/api/amo/webhooks/deduplicate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `contacts[add][0][id]=${contactBId}`
      });
      const data = await res.json();
      console.log('Webhook Response:', data);
      
      console.log('Waiting 5 seconds for webhook async processing...');
      await new Promise(r => setTimeout(r, 5000));
      
      console.log('Checking Lead B status...');
      const leadB = await amoFetchJson<any>(`api/v4/leads/${leadBId}`);
      console.log(`Lead B status: ${leadB.status_id} (Expected 143)`);
      
      console.log('Checking Lead A notes...');
      const notes = await amoFetchJson<any>(`api/v4/leads/${leadAId}/notes`);
      console.log('Lead A Notes count:', notes._embedded?.notes?.length || 0);
  } catch(e) {
      console.error(e);
  }
}
main().catch(console.error);
