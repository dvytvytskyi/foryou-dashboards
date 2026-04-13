import fs from 'fs';

const listings = JSON.parse(fs.readFileSync('./pf_listings_report.json', 'utf8'));
const projects = JSON.parse(fs.readFileSync('./pf_projects_report.json', 'utf8'));

const totalListings = listings.reduce((sum, l) => sum + (l.Budget || 0), 0);
const totalProjects = projects.reduce((sum, p) => sum + (p.Budget || 0), 0);

console.log('Total Listings Budget:', totalListings);
console.log('Total Projects Budget (Primary Plus):', totalProjects);
console.log('Grand Total:', totalListings + totalProjects);
