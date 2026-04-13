import fs from 'fs';
import path from 'path';

// Credentials provided by user
const PF_API_KEY = 'OJIlJ.2x35n9PkjxHYTwuN5xI3UsqLxXqUR9c44R';
const PF_API_SECRET = '1mAsFUrBgd0aPFHc6BvGja25DbKe1Bb5';

async function testPFConnection() {
    console.log('--- TESTING PROPERTY FINDER API CONNECTION ---');
    
    // Enterprise API usually uses X-Api-Key and X-Api-Secret or Basic Auth
    // Based on common PF API patterns: 
    // They might require an Access Token first or direct headers.
    
    const url = 'https://api.propertyfinder.net/enterprise/v1/leads';
    
    try {
        const res = await fetch(url, {
            headers: {
                'X-Api-Key': PF_API_KEY,
                'X-Api-Secret': PF_API_SECRET,
                'Accept': 'application/json'
            }
        });

        if (res.ok) {
            const data = await res.json();
            console.log('SUCCESS! Connected to Property Finder.');
            console.log('Sample Leads Count:', data.data?.length || 0);
            if (data.data && data.data.length > 0) {
                console.log('First lead sample:', JSON.stringify(data.data[0], null, 2));
            }
        } else {
            console.error('FAILED to connect:', res.status);
            const err = await res.text();
            console.error('Error details:', err);
        }
    } catch (e) {
        console.error('Error during fetch:', e.message);
    }
}

testPFConnection().catch(console.error);
