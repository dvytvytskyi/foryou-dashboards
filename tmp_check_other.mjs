import { readFileSync } from 'fs';
const rows = JSON.parse(readFileSync('pf_listings_report.json', 'utf8'));
const ourRows = rows.filter(r => (r.group || r.category) === 'Our');
const validCats = ['Sell','Rent','Commercial Sell','Commercial Rent'];
const other = ourRows.filter(r => !validCats.includes(r.Category));
console.log('Other count:', other.length);
const cats = [...new Set(other.map(r => r.Category))];
console.log('Other categories in JSON:', cats);

// Now check postgres-mapped categories
// In postgres route: category comes from offering_type
// Let's see what offering_type values exist in JSON
const offeringTypes = [...new Set(ourRows.map(r => r.offering_type || r.OfferingType || 'N/A'))];
console.log('offering_type values:', offeringTypes);

// Check the Category field values
const allCats = [...new Set(ourRows.map(r => r.Category))];
console.log('All Category values in Our group:', allCats);
