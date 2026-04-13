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
    const res = await fetch('https://atlas.propertyfinder.com/v1/listings?perPage=50&page=1', {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
    });
    const data = await res.json();
    
    // Find a listing that has credits (e.g. reference 00000495 from the md file)
    const listings = data.data || [];
    listings.forEach(l => {
        if (l.reference === '00000495' || l.credits > 0) {
            console.log('Listing with credits:', JSON.stringify(l, null, 2));
        }
    });

    // If none found, show the first one's keys
    if (listings.length > 0) {
        console.log('Available keys in listing:', Object.keys(listings[0]));
        if (listings[0].promotion) console.log('Promotion Keys:', Object.keys(listings[0].promotion));
    }
}

debugListing().catch(console.error);
