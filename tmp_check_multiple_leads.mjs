import fs from 'fs';

const tokens = JSON.parse(fs.readFileSync('secrets/amo_tokens.json', 'utf8'));
const leadIds = [45399843, 32371415, 45400000, 45400100];

(async () => {
  for (const leadId of leadIds) {
    console.log(`\n=== Lead #${leadId} ===`);
    const res = await fetch(`https://reforyou.amocrm.ru/api/v4/leads/${leadId}/notes?limit=100`, {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });
    
    if (!res.ok) {
      console.log('✗ Lead not found or error');
      continue;
    }
    
    const data = await res.json();
    const notes = data._embedded?.notes || [];
    console.log('Total notes:', notes.length);
    
    if (notes.length === 0) {
      console.log('  (no notes)');
      continue;
    }
    
    const types = {};
    notes.forEach(n => {
      types[n.note_type] = (types[n.note_type] || 0) + 1;
    });
    
    Object.entries(types).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
    
    // Check for wazzup specifically
    const wazzupNotes = notes.filter(n => 
      n.note_type?.toLowerCase().includes('wazzup') || 
      n.note_type?.toLowerCase().includes('whatsapp') ||
      n.note_type?.toLowerCase().includes('message')
    );
    if (wazzupNotes.length > 0) {
      console.log(`  ✅ FOUND WAZZUP: ${wazzupNotes.length} messages`);
    }
  }
})().catch(console.error);
