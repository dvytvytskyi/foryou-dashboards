async function getToken(apiKey, apiSecret) {
  const res = await fetch('https://atlas.propertyfinder.com/v1/auth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({ apiKey, apiSecret })
  });
  const data = await res.json();
  return data.accessToken;
}

async function getListingPrice(token, id) {
    const res = await fetch(`https://atlas.propertyfinder.com/v1/listings/${id}/publish/prices`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
    });
    return await res.json();
}

async function main() {
    const apiKey = process.env.PF_KEY;
    const apiSecret = process.env.PF_SECRET;
    const token = await getToken(apiKey, apiSecret);
    
    // Get some listings
    const res = await fetch(`https://atlas.propertyfinder.com/v1/listings?perPage=10`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
    });
    const data = await res.json();
    const listings = data.results || [];

    for (const l of listings) {
        const price = await getListingPrice(token, l.id);
        const level = l.products?.premium ? 'Premium' : (l.products?.featured ? 'Featured' : 'Standard');
        console.log(`Ref: ${l.reference} | Level: ${level} | Prices:`, JSON.stringify(price, null, 2));
    }
}

main();
