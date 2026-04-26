import fs from 'fs';

const tokens = JSON.parse(fs.readFileSync('secrets/amo_tokens.json', 'utf8'));
console.log('Token expires:', new Date((tokens.expires_at || 0) * 1000).toISOString());
console.log('Current time:', new Date().toISOString());

(async () => {
  // Check account
  let res = await fetch('https://reforyou.amocrm.ru/api/v4/account', {
    headers: { 'Authorization': `Bearer ${tokens.access_token}` }
  });
  console.log('\n=== AUTH CHECK ===');
  console.log('Account status:', res.status);
  if (res.ok) {
    const data = await res.json();
    console.log('Account:', data._embedded?.account?.[0]?.name);
  }

  // Get recent leads
  res = await fetch('https://reforyou.amocrm.ru/api/v4/leads?limit=10&with=contacts', {
    headers: { 'Authorization': `Bearer ${tokens.access_token}` }
  });
  const data = await res.json();
  const leads = data._embedded?.leads || [];
  console.log('\n=== RECENT LEADS ===');
  leads.slice(0, 5).forEach(l => {
    console.log(`- #${l.id}: ${l.name} (created ${new Date(l.created_at * 1000).toISOString().split('T')[0]})`);
  });

  // Check notes for leads
  console.log('\n=== NOTES BY LEAD ===');
  for (const lead of leads.slice(0, 5)) {
    const notesRes = await fetch(`https://reforyou.amocrm.ru/api/v4/leads/${lead.id}/notes?limit=50`, {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });
    const notesData = await notesRes.json();
    const notes = notesData._embedded?.notes || [];
    
    if (notes.length > 0) {
      const types = [...new Set(notes.map(n => n.note_type))];
      console.log(`\nLead #${lead.id} (${lead.name}): ${notes.length} notes`);
      console.log(`  Types: ${types.join(', ')}`);
      
      // Show samples
      notes.slice(0, 5).forEach(n => {
        const text = (n.params?.text || n.params?.body || '').substring(0, 80);
        console.log(`  - ${n.note_type}: "${text}"`);
      });
    }
  }
})().catch(console.error);
