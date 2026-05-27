import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const API_URL = 'https://atlas.propertyfinder.com/v1';

async function getToken() {
  const apiKey = process.env.PF_API_KEY;
  const apiSecret = process.env.PF_API_SECRET;
  const res = await fetch(`${API_URL}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ apiKey, apiSecret }),
  });
  const data = await res.json();
  return data.accessToken;
}

async function run() {
  try {
    const token = await getToken();
    const url = `${API_URL}/listings?filter[state]=live&include=location,project,floorPlan,unit,building&perPage=5&page=1`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const data = await res.json();
    const listings = data.results || data.data || [];
    
    console.log(`Fetched ${listings.length} listings. Checking fields...`);
    listings.forEach((l, i) => {
      console.log(`\nListing ${i + 1} (${l.reference}):`);
      console.log('Project:', JSON.stringify(l.project, null, 2));
      console.log('Location:', JSON.stringify(l.location, null, 2));
      console.log('Unit:', JSON.stringify(l.unit, null, 2));
      console.log('Building:', JSON.stringify(l.building, null, 2));
      console.log('Property Type:', l.propertyType);
    });
  } catch(e) {
    console.error(e);
  }
}
run();
