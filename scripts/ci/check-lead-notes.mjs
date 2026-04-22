import fs from 'fs';

console.log('📂 Reading token file...');
let tokenContent;
try {
  tokenContent = fs.readFileSync('secrets/amo_tokens.json', 'utf8');
  console.log('✓ File read, size:', tokenContent.length);
} catch (e) {
  console.error('✗ Failed to read token file:', e.message);
  process.exit(1);
}

let tokens;
try {
  tokens = JSON.parse(tokenContent);
  console.log('✓ JSON parsed successfully');
} catch (e) {
  console.error('✗ Failed to parse JSON:', e.message);
  console.error('Content preview:', tokenContent.substring(0, 200));
  process.exit(1);
}

const leadId = process.argv[2] || '45399843';

console.log('\n🔍 Token details:');
console.log('  - access_token exists:', !!tokens.access_token);
console.log('  - token type:', tokens.token_type);
console.log('  - expires_in:', tokens.expires_in);

if (!tokens.access_token) {
  console.error('✗ No access_token in parsed JSON!');
  console.error('Available keys:', Object.keys(tokens));
  process.exit(1);
}

(async () => {
  console.log(`\n=== Checking Lead #${leadId} ===\n`);
  
  // Check auth
  let res = await fetch('https://reforyou.amocrm.ru/api/v4/account', {
    headers: { 'Authorization': `Bearer ${tokens.access_token}` }
  });
  console.log('✓ Auth status:', res.status);
  
  if (!res.ok) {
    console.log('✗ Auth failed!');
    const err = await res.text();
    console.log(err);
    process.exit(1);
  }
  
  // Get lead info
  res = await fetch(`https://reforyou.amocrm.ru/api/v4/leads/${leadId}`, {
    headers: { 'Authorization': `Bearer ${tokens.access_token}` }
  });
  
  if (!res.ok) {
    console.log('✗ Lead not found');
    process.exit(1);
  }
  
  const lead = await res.json();
  console.log(`Lead: ${lead.name}`);
  console.log(`Created: ${new Date(lead.created_at * 1000).toISOString()}\n`);
  
  // Get notes
  res = await fetch(`https://reforyou.amocrm.ru/api/v4/leads/${leadId}/notes?limit=100`, {
    headers: { 'Authorization': `Bearer ${tokens.access_token}` }
  });
  
  const notesData = await res.json();
  const notes = notesData._embedded?.notes || [];
  
  console.log(`📝 Total Notes: ${notes.length}`);
  
  if (notes.length === 0) {
    console.log('No notes found.');
    process.exit(0);
  }
  
  // Group by type
  const typeMap = {};
  notes.forEach(n => {
    if (!typeMap[n.note_type]) typeMap[n.note_type] = [];
    typeMap[n.note_type].push(n);
  });
  
  console.log('\n📊 Note Types:');
  Object.entries(typeMap).forEach(([type, typeNotes]) => {
    console.log(`\n  ${type}: ${typeNotes.length}`);
    typeNotes.slice(0, 2).forEach(n => {
      const text = (n.params?.text || n.params?.body || '').substring(0, 100);
      const date = new Date(n.created_at * 1000).toISOString().split('T')[0];
      console.log(`    - [${date}] ${text || '(empty)'}`);
    });
    if (typeNotes.length > 2) {
      console.log(`    ... and ${typeNotes.length - 2} more`);
    }
  });
  
  // If there are wazzup notes, show their structure
  const wazzupNotes = notes.filter(n => 
    n.note_type?.toLowerCase().includes('wazzup') || 
    n.note_type?.toLowerCase().includes('whatsapp') ||
    n.note_type?.toLowerCase().includes('message')
  );
  
  if (wazzupNotes.length > 0) {
    console.log(`\n\n💬 Wazzup/WhatsApp Notes (${wazzupNotes.length}):`);
    console.log(JSON.stringify(wazzupNotes[0], null, 2));
  }
})().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
