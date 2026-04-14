import fs from 'fs';
import path from 'path';

const reportPath = path.resolve('./pf_listings_report.json');

async function analyzeIds() {
    const data = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    console.log(`Analyzing ${data.length} listings in report...`);

    const targets = ['30371', '9674', '8439', '8292'];
    
    targets.forEach(t => {
        const matches = data.filter(i => i.Reference && i.Reference.includes(t));
        if (matches.length > 0) {
            console.log(`\nID "${t}" matched ${matches.length} items:`);
            matches.forEach(m => console.log(` - Ref: ${m.Reference}, Title: ${m.Title}`));
        } else {
            console.log(`\nID "${t}" - NO MATCH FOUND`);
        }
    });

    // Check if there are any references that ARE just numbers
    const numericRefs = data.filter(i => /^\d+$/.test(i.Reference));
    if (numericRefs.length > 0) {
        console.log(`\nFound ${numericRefs.length} listings with purely numeric References.`);
        numericRefs.slice(0, 5).forEach(m => console.log(` - Ref: ${m.Reference}`));
    }
}

analyzeIds().catch(console.error);
