import { NextRequest, NextResponse } from 'next/server';
import { amoFetchJson } from '@/lib/amo';

export async function POST(req: NextRequest) {
  try {
    const text = await req.text();
    const params = new URLSearchParams(text);

    // Look for add_contact events
    // AmoCRM sends: contacts[add][0][id]
    const addedContactIds = new Set<string>();
    
    for (const [key, value] of params.entries()) {
      const match = key.match(/^contacts\[add\]\[\d+\]\[id\]$/);
      if (match) {
        addedContactIds.add(value);
      }
    }

    if (addedContactIds.size === 0) {
      return NextResponse.json({ success: true, message: 'No contacts added.' });
    }

    // Process each added contact asynchronously
    // (We don't await this so AmoCRM gets a fast 200 OK)
    processDuplicates(Array.from(addedContactIds)).catch(console.error);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Webhook Deduplicate Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

async function processDuplicates(contactIds: string[]) {
  console.log(`Processing ${contactIds.length} added contacts for duplicates...`);
  
  for (const contactId of contactIds) {
    try {
      // 1. Fetch the newly added contact to get its phone number
      const newContact = await amoFetchJson<any>(`api/v4/contacts/${contactId}?with=leads`);
      const phoneField = newContact.custom_fields_values?.find((f: any) => f.field_code === 'PHONE');
      
      if (!phoneField || !phoneField.values || phoneField.values.length === 0) {
        console.log(`Contact ${contactId} has no phone. Skipping deduplication.`);
        continue;
      }

      const phone = phoneField.values[0].value;
      // We take the last 10 digits to match loosely if needed, or exact match.
      // Exact match is safer.
      const sanitizedPhone = phone.replace(/[^\d+]/g, '');

      // 2. Search AmoCRM for this phone number
      let searchRes: any;
      try {
        searchRes = await amoFetchJson<any>(`api/v4/contacts?query=${encodeURIComponent(sanitizedPhone)}&with=leads`);
      } catch (e: any) {
        if (e.message && e.message.includes('204')) continue;
        throw e;
      }

      const contacts = searchRes._embedded?.contacts || [];
      if (contacts.length <= 1) {
        console.log(`No duplicates found for contact ${contactId}.`);
        continue;
      }

      console.log(`Found ${contacts.length} contacts with phone ${sanitizedPhone}.`);
      
      // Sort contacts by ID ascending (oldest first)
      contacts.sort((a: any, b: any) => a.id - b.id);
      
      const primaryContact = contacts[0];
      
      // If the new contact is somehow the oldest, skip (shouldn't happen unless we are processing old data)
      if (primaryContact.id.toString() === contactId) {
          console.log(`Contact ${contactId} is already the primary contact. Skipping.`);
          continue;
      }

      console.log(`Primary contact is ${primaryContact.id}. Merging ${contactId} into it.`);

      // 3. Move leads from the new contact to the primary contact
      const leadsToMove = newContact._embedded?.leads || [];
      for (const lead of leadsToMove) {
        const leadId = lead.id;
        
        // Link to primary
        try {
          await amoFetchJson(`api/v4/leads/${leadId}/link`, {
            method: 'POST',
            body: JSON.stringify([ { to_entity_id: primaryContact.id, to_entity_type: 'contacts' } ])
          });
          console.log(`Linked lead ${leadId} to primary contact ${primaryContact.id}`);
        } catch(e: any) {
          console.error(`Failed to link lead ${leadId}:`, e.message);
        }
        
        // Unlink from the duplicate contact
        try {
          await amoFetchJson(`api/v4/leads/${leadId}/unlink`, {
            method: 'POST',
            body: JSON.stringify([ { to_entity_id: contactId, to_entity_type: 'contacts' } ])
          });
          console.log(`Unlinked lead ${leadId} from duplicate contact ${contactId}`);
        } catch(e: any) {
          console.error(`Failed to unlink lead ${leadId}:`, e.message);
        }
      }

      // 4. Invalidate the duplicate contact to prevent future matches
      // We append "DUPLICATE_" to the phone so it won't match future exact searches
      try {
        await amoFetchJson(`api/v4/contacts/${contactId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: `[DUBL] ${newContact.name}`,
            custom_fields_values: [
              {
                field_id: phoneField.field_id,
                values: [
                  { value: `DUP_${sanitizedPhone}` }
                ]
              }
            ]
          })
        });
        console.log(`Marked contact ${contactId} as duplicate.`);
      } catch (e: any) {
        console.error(`Failed to update duplicate contact ${contactId}:`, e.message);
      }

    } catch (e: any) {
      console.error(`Failed to process contact ${contactId}:`, e.message);
    }
  }
}
