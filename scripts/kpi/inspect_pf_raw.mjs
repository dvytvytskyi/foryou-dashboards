import fs from 'fs';
import path from 'path';

const PF_API_KEY = 'OJIlJ.2x35n9PkjxHYTwuN5xI3UsqLxXqUR9c44R';
const PF_API_SECRET = '1mAsFUrBgd0aPFHc6BvGja25DbKe1Bb5';

async function getPFToken() {
    const res = await fetch('https://atlas.propertyfinder.com/v1/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ apiKey: PF_API_KEY, apiSecret: PF_API_SECRET })
    });
    const data = await res.json();
    return data.accessToken;
}

async function inspectRawPF() {
    const token = await getPFToken();
    const res = await fetch('https://atlas.propertyfinder.com/v1/leads?perPage=5', {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
    });
    const data = await res.json();
    console.log(JSON.stringify(data.data, null, 2));
}

inspectRawPF();
