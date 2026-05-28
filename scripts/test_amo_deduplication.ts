import { amoFetchJson, amoFetch } from '../src/lib/amo';

async function main() {
  const testPhone = '+971555555999'; // Changed to 999 to avoid clash
  const pipelineId = 10761794;
  const userId = 10688694; // Dima

  console.log('1. Creating Contact A...');
  let contactAId;
  const createA = await amoFetchJson<any>('api/v4/contacts', {
    method: 'POST',
    body: JSON.stringify([
      {
        name: 'Test Contact A',
        responsible_user_id: userId,
        custom_fields_values: [
          { field_code: 'PHONE', values: [{ value: testPhone }] }
        ]
      }
    ])
  });
  contactAId = createA._embedded.contacts[0].id;
  console.log(`Created Contact A: ${contactAId}`);

  console.log('2. Creating Lead A for Contact A...');
  const createLeadA = await amoFetchJson<any>('api/v4/leads', {
    method: 'POST',
    body: JSON.stringify([
      {
        name: 'Test Lead A',
        pipeline_id: pipelineId,
        responsible_user_id: userId,
        _embedded: { contacts: [{ id: contactAId }] }
      }
    ])
  });
  const leadAId = createLeadA._embedded.leads[0].id;
  console.log(`Created Lead A: ${leadAId}`);

  console.log('3. Creating Contact B (Duplicate)...');
  let contactBId;
  const createB = await amoFetchJson<any>('api/v4/contacts', {
    method: 'POST',
    body: JSON.stringify([
      {
        name: 'Test Contact B',
        responsible_user_id: userId,
        custom_fields_values: [
          { field_code: 'PHONE', values: [{ value: testPhone }] }
        ]
      }
    ])
  });
  contactBId = createB._embedded.contacts[0].id;
  console.log(`Created Contact B: ${contactBId}`);

  console.log('4. Creating Lead B for Contact B...');
  const createLeadB = await amoFetchJson<any>('api/v4/leads', {
    method: 'POST',
    body: JSON.stringify([
      {
        name: 'Test Lead B',
        pipeline_id: pipelineId,
        responsible_user_id: userId,
        _embedded: { contacts: [{ id: contactBId }] }
      }
    ])
  });
  const leadBId = createLeadB._embedded.leads[0].id;
  console.log(`Created Lead B: ${leadBId}`);

  console.log('\n--- ATTEMPTING MERGE ---');
  // First, check if POST /api/v4/contacts/merge works? No, it usually doesn't exist for developers.
  // We will manually link Lead B to Contact A, and remove Contact B's phone.
  console.log(`Linking Lead ${leadBId} to Contact A ${contactAId}...`);
  try {
      await amoFetchJson(`api/v4/leads/${leadBId}/link`, {
          method: 'POST',
          body: JSON.stringify([ { to_entity_id: contactAId, to_entity_type: 'contacts' } ])
      });
      console.log('Lead B linked to Contact A.');
      
      // We must unlink from Contact B?
      // Wait, leads can have multiple contacts. Unlinking:
      await amoFetchJson(`api/v4/leads/${leadBId}/unlink`, {
          method: 'POST',
          body: JSON.stringify([ { to_entity_id: contactBId, to_entity_type: 'contacts' } ])
      });
      console.log('Lead B unlinked from Contact B.');
      
  } catch(e: any) {
      console.log('Linking failed:', e.message);
  }

  console.log('\nFetching Lead B to verify contacts attached...');
  const leadB = await amoFetchJson<any>(`api/v4/leads/${leadBId}?with=contacts`);
  console.log('Lead B Contacts:', leadB._embedded.contacts);

  console.log('\nRemoving phone from Contact B and renaming it to "Merged Duplicate"...');
  await amoFetchJson<any>(`api/v4/contacts/${contactBId}`, {
      method: 'PATCH',
      body: JSON.stringify({
          name: 'Merged Duplicate',
          custom_fields_values: [
              { field_code: 'PHONE', values: [] }
          ]
      })
  });
  console.log('Contact B marked as merged duplicate.');
}

main().catch(console.error);
