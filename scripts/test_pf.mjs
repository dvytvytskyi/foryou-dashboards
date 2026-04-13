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

async function getListings(token) {
  let allListings = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    console.log(`Fetching page ${page}...`);
    const res = await fetch(`https://atlas.propertyfinder.com/v1/listings?page=${page}&perPage=100`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
    const data = await res.json();
    if (data.results) {
      allListings = allListings.concat(data.results);
    }
    totalPages = data.pagination?.totalPages || 1;
    page++;
    if (page > 3) break; // Limit for speed
  }
  return allListings;
}

async function main() {
  const apiKey = process.env.PF_KEY;
  const apiSecret = process.env.PF_SECRET;

  if (!apiKey || !apiSecret) {
    console.error('PF_KEY and PF_SECRET must be set');
    return;
  }

  try {
    const token = await getToken(apiKey, apiSecret);
    const listings = await getListings(token);
    
    const stats = {
        'Sell': 0, 'Rent': 0, 'Commercial Sell': 0, 'Commercial Rent': 0, 'Other': 0
    };

    listings.forEach(l => {
      const isComm = l.category === 'commercial';
      const isRent = l.price?.type === 'rent';
      
      let groupKey = 'Other';
      if (!isComm && !isRent) groupKey = 'Sell';
      else if (!isComm && isRent) groupKey = 'Rent';
      else if (isComm && !isRent) groupKey = 'Commercial Sell';
      else if (isComm && isRent) groupKey = 'Commercial Rent';

      stats[groupKey]++;
    });

    console.log('Stats:', stats);
    if (listings.length > 0) {
        console.log('Sample Product levels for first 5:');
        listings.slice(0, 5).forEach(l => {
            console.log(`- ${l.reference}: F:${!!l.products?.featured} P:${!!l.products?.premium} S:${!!l.products?.standard}`);
        });
    }
  } catch (e) {
    console.error(e);
  }
}

main();
