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

      console.log(`Primary contact is ${primaryContact.id}. Analyzing its leads...`);

      // 3. Check for ACTIVE leads on the Primary Contact
      const primaryLeadIds = primaryContact._embedded?.leads?.map((l: any) => l.id) || [];
      
      let activeLeadId = null;
      let responsibleUserId = primaryContact.responsible_user_id;

      if (primaryLeadIds.length > 0) {
        try {
          // Fetch all primary leads details
          const leadsRes = await amoFetchJson<any>(`api/v4/leads?filter[id]=${primaryLeadIds.join(',')}`);
          const primaryLeads = leadsRes?._embedded?.leads || [];
          
          // Find if there is any active lead (status_id !== 142 && status_id !== 143)
          for (const lead of primaryLeads) {
            if (lead.status_id !== 142 && lead.status_id !== 143) {
              activeLeadId = lead.id;
              responsibleUserId = lead.responsible_user_id || responsibleUserId;
              break; // Found an active lead
            }
          }
        } catch(e: any) {
            console.error(`Error fetching primary leads details:`, e.message);
        }
      }

      const newLeads = newContact._embedded?.leads || [];

      if (activeLeadId) {
        console.log(`Primary contact ${primaryContact.id} has ACTIVE lead ${activeLeadId}. Merging as Note/Task.`);
        
        for (const lead of newLeads) {
           const leadId = lead.id;
           
           try {
               const fullNewLead = await amoFetchJson<any>(`api/v4/leads/${leadId}`);
               
               let noteText = `⚠️ ПОВТОРНЫЙ ЗАПРОС!\nКлиент оставил заявку.\n\nДанные из новой заявки:\n`;
               
               if (fullNewLead.custom_fields_values) {
                  for (const field of fullNewLead.custom_fields_values) {
                     const value = field.values.map((v: any) => v.value || v.enum_code || '').join(', ');
                     noteText += `- ${field.field_name}: ${value}\n`;
                  }
               } else {
                   noteText += `(нет дополнительных данных)\n`;
               }
               
               // Add note to ACTIVE lead
               await amoFetchJson(`api/v4/leads/${activeLeadId}/notes`, {
                 method: 'POST',
                 body: JSON.stringify([{
                     note_type: 'common',
                     params: { text: noteText }
                 }])
               });

               // Add task to ACTIVE lead
               await amoFetchJson(`api/v4/tasks`, {
                 method: 'POST',
                 body: JSON.stringify([{
                     task_type_id: 1, // Follow-up type
                     text: 'Клиент из активной сделки снова обратился! Проверь новые данные',
                     complete_till: Math.floor(Date.now() / 1000) + 3600, // +1 hour
                     entity_id: activeLeadId,
                     entity_type: 'leads',
                     responsible_user_id: responsibleUserId
                 }])
               });

               // Close new lead (set status 143)
               await amoFetchJson(`api/v4/leads/${leadId}`, {
                 method: 'PATCH',
                 body: JSON.stringify({
                     status_id: 143,
                     name: `[DUBL] ${fullNewLead.name || 'Сделка'}`
                 })
               });
               
               console.log(`Successfully merged lead ${leadId} into active lead ${activeLeadId} via Note/Task.`);
           } catch(e: any) {
               console.error(`Failed to process new lead ${leadId} for active lead merge:`, e.message);
           }
        }
      } else {
        console.log(`Primary contact ${primaryContact.id} has NO active leads. Linking new leads to it.`);
        
        for (const lead of newLeads) {
          const leadId = lead.id;
          
          try {
            await amoFetchJson(`api/v4/leads/${leadId}/link`, {
              method: 'POST',
              body: JSON.stringify([ { to_entity_id: primaryContact.id, to_entity_type: 'contacts' } ])
            });
            console.log(`Linked lead ${leadId} to primary contact ${primaryContact.id}`);
          } catch(e: any) {
            console.error(`Failed to link lead ${leadId}:`, e.message);
          }
          
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
      }

      // 4. Invalidate the duplicate contact to prevent future matches
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
