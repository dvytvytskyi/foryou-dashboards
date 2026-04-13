import { BigQuery } from '@google-cloud/bigquery';
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

async function testPrice() {
    const token = await getPFToken();
    // Використаємо один з ваших референсів для тесту
    const testId = 'for-you-real-estate-9962443'; 
    const url = `https://atlas.propertyfinder.com/v1/listings/${testId}/publish/prices`;
    
    console.log(`Testing price for listing ${testId}...`);
    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
    });
    
    if (res.ok) {
        const data = await res.json();
        console.log('Price Data:', JSON.stringify(data, null, 2));
    } else {
        console.log(`Failed to get price: ${res.status} ${await res.text()}`);
    }
}

testPrice();
