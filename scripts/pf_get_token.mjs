// Скрипт для отримання access token Property Finder API
// Node.js (ESM)
import fetch from 'node-fetch';

const API_URL = 'https://atlas.propertyfinder.com/v1/auth/token';

const apiKey = 'ajaLR.1Yu2LlcI0l31dtZxoEckinl81fT0splJwG';
const apiSecret = 'lZ8vItNTiKsq1u27BIcjr71a2L6MAXHH';

async function getToken() {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({ apiKey, apiSecret })
  });
  const data = await res.json();
  console.log(data);
}

getToken().catch(console.error);
