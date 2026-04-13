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

async function fetchTransactions() {
    try {
        const token = await getPFToken();
        const url = `https://atlas.propertyfinder.com/v1/credits/transactions?perPage=50`;
        
        console.log('Fetching credit transactions...');
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });
        
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const data = await res.json();
        
        console.log('Sample Transaction Data:', JSON.stringify(data.data?.[0], null, 2));
        console.log(`Total transactions returned in this page: ${data.data?.length}`);
    } catch (e) {
        console.error('Test failed:', e.message);
    }
}

fetchTransactions();
