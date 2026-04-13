import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve('./.env') });

const AMO_TOKENS_FILE = path.resolve('./secrets/amo_tokens.json');
const domain = process.env.AMO_DOMAIN || 'reforyou.amocrm.ru';

async function exchangeToken(code) {
    console.log('--- EXCHANGING AUTH CODE FOR TOKENS ---');
    console.log('Code ends with:', code.substring(code.length - 10));
    
    const body = {
        client_id: process.env.AMO_CLIENT_ID,
        client_secret: process.env.AMO_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.AMO_REDIRECT_URI
    };

    const res = await fetch(`https://${domain}/oauth2/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (res.ok) {
        const tokens = await res.json();
        fs.writeFileSync(AMO_TOKENS_FILE, JSON.stringify(tokens, null, 2));
        console.log('SUCCESS! Tokens saved to:', AMO_TOKENS_FILE);
    } else {
        const err = await res.text();
        console.error('EXCHANGE FAILED:', res.status, err);
    }
}

const code = 'def50200851cb990bf871001144fe9fac995cd1ebbca82dd1618a276d8aa1dfc1f313635f391c59922a2314258bf570fabb26b6961ea5959e7a12d8965f2301097c88ea1aa429cc25a8f0cdfbe7c6d346c4c343bee8f3b7d10d98676b074540480e134efe5962bfb2015766cada68b06d8b0bb246bad2dc55acf5dd3bf238fb61211f01cee8f68d0dcf51757f3012fbd91e7f7c47e78f1811c174d164dfce30fbe421c8fd8c21802c1c9c5c4d4d6811aec5dab0b6ed3fb8d6671a66821036141eeca9afb44567cfc8bdaa026af1252e468297f4769e2d2f1ce8d2e3f82218a5049d1e49e8c0dfb90c46180ab0e9bae6c3c9b776475427acc51743257d829c4f8b6629f638081206325a8b2870aecb566b11b4bcb8ac4ddef72ce2f5fa8c303848f62244e5a16d8458521b83711efdbfa46b8b8818b052593d38835cc61497b5ad900d47dad971fbeb5a180a4c384825b7c89e2eeb9e2d4239839e3686d472f5cb1c4f0ac3b0282b230ce7249a61781132edfea366cd149ec3472b1b204c4088a32ef619f144f08c33f06ff65a43195627125efd8d6e2a9142ea600da1e54819d7c2647da2486190e699ec91f19e2150fd8f64fb5374ca616707c9176e906cef9c7254675f991de43d0e9451c8629b3f0608f251a06f2f04f42ca8bc8c07946d43c251cd13c128627947abebac53be828cadac7e9a4c321028be80dceee35ce0b0e6dbbd26ca0455947378953';
exchangeToken(code).catch(console.error);
