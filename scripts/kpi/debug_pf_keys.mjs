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
    const res = await fetch('https://atlas.propertyfinder.com/v1/listings?perPage=5&page=1', {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
    });
    const data = await res.json();
    
    if (data.data && data.data.length > 0) {
        data.data.forEach(l => {
            console.log(`Ref: ${l.reference}, Keys: ${Object.keys(l).join(', ')}`);
            if (l.promotion) console.log(`  Promotion: ${JSON.stringify(l.promotion)}`);
        });
    } else {
        console.log('No listings found in response or error:', data);
    }
}

debugListing().catch(console.error);
