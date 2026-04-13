import path from 'path';

const PF_API_KEY = 'OJIlJ.2x35n9PkjxHYTwuN5xI3UsqLxXqUR9c44R';
const PF_API_SECRET = '1mAsFUrBgd0aPFHc6BvGja25DbKe1Bb5';

async function getPFToken() {
    const res = await fetch('https://atlas.propertyfinder.com/v1/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: PF_API_KEY, apiSecret: PF_API_SECRET })
    });
    const data = await res.json();
    return data.accessToken;
}

async function debugListing() {
    const token = await getPFToken();
    const res = await fetch('https://atlas.propertyfinder.com/v1/listings?perPage=1&page=1', {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
    });
    if (!res.ok) {
        console.error('API Error:', res.status, await res.text());
        return;
    }
    const data = await res.json();
    console.log('Full Response:', JSON.stringify(data, null, 2));
}

debugListing().catch(console.error);
