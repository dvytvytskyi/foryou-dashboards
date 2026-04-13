async function testApi() {
    try {
        const res = await fetch('http://localhost:3000/api/pf-projects');
        const json = await res.json();
        const withSpam = json.data.filter(r => r.no_answer_spam > 0 || r.qualified_leads > 0);
        console.log(`Found ${withSpam.length} rows with stats.`);
        if (withSpam.length > 0) {
            console.log(JSON.stringify(withSpam.slice(0, 2), null, 2));
        }
    } catch (e) {
        console.error('API Error:', e.message);
    }
}

testApi();
