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
    const url = `${API_URL}/locations/12940`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch(e) {
    console.error(e);
  }
}
run();
