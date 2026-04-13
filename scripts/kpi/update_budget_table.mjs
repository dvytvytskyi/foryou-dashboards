import fs from 'fs';
import path from 'path';

const LISTINGS_JSON = path.resolve('./pf_listings_report.json');
const PROJECTS_JSON = path.resolve('./pf_projects_report.json');
const TABLE_MD = path.resolve('./PROPERTY_FINDER_TABLE.md');

function formatNumber(num) {
    if (num === 0 || isNaN(num)) return '-';
    return new Intl.NumberFormat('en-US').format(num);
}

async function updateBudgetTable() {
    try {
        console.log('--- UPDATING PROPERTY_FINDER_TABLE.MD WITH BUDGET DATA ---');
        
        const listings = JSON.parse(fs.readFileSync(LISTINGS_JSON, 'utf8'));
        const projects = JSON.parse(fs.readFileSync(PROJECTS_JSON, 'utf8'));
        
        // Create lookup maps
        const listingBudgets = {};
        listings.forEach(l => {
            listingBudgets[l.Reference] = l.Budget || 0;
        });

        const totalBudget = listings.reduce((s, l) => s + (l.Budget || 0), 0) + projects.reduce((s, p) => s + (p.Budget || 0), 0);

        let lines = fs.readFileSync(TABLE_MD, 'utf8').split('\n');
        let newLines = [];
        
        // 1. Update existing lines and calculate category totals
        let currentCategory = null;
        let categoryTotals = {
            'Sell': 0,
            'Rent': 0,
            'Commercial Sell': 0,
            'Commercial Rent': 0
        };

        // We'll first calculate category totals from the JSON to be accurate
        listings.forEach(l => {
            if (categoryTotals[l.Category] !== undefined) {
                categoryTotals[l.Category] += l.Budget || 0;
            }
        });

        for (let line of lines) {
            // Update Total Property Finder Budget
            if (line.includes('**Property Finder**')) {
                line = `| **Property Finder** | **${formatNumber(totalBudget)}** |`;
            }
            
            // Match Category Headers
            const catMatch = line.match(/📂 \*\*(.*?)\*\*/);
            if (catMatch) {
                currentCategory = catMatch[1];
                if (categoryTotals[currentCategory] !== undefined) {
                    line = `| &nbsp;&nbsp;📂 **${currentCategory}** | **${formatNumber(categoryTotals[currentCategory])}** |`;
                }
            }

            // Match Listing Rows
            const refMatch = line.match(/↳ `(.*?)`/);
            if (refMatch) {
                const ref = refMatch[1];
                const budget = listingBudgets[ref];
                if (budget !== undefined) {
                    line = `| &nbsp;&nbsp;&nbsp;&nbsp;↳ \`${ref}\` | ${formatNumber(budget)} |`;
                }
            }

            newLines.push(line);
        }

        // 2. Add Primary Plus Section if not exists
        if (!newLines.some(l => l.includes('📂 **Primary Plus**'))) {
            const projectTotal = projects.reduce((s, p) => s + (p.Budget || 0), 0);
            newLines.push(`| &nbsp;&nbsp;📂 **Primary Plus** | **${formatNumber(projectTotal)}** |`);
            
            // Sort projects by budget descending and show those with budget > 0
            const activeProjects = projects
                .filter(p => p.Budget > 0)
                .sort((a,b) => b.Budget - a.Budget);
            
            activeProjects.forEach(p => {
                newLines.push(`| &nbsp;&nbsp;&nbsp;&nbsp;↳ \`${p.Title}\` (${p.ProjectId.substring(0,8)}) | ${formatNumber(p.Budget)} |`);
            });
        }

        fs.writeFileSync(TABLE_MD, newLines.join('\n'));
        console.log('SUCCESS: PROPERTY_FINDER_TABLE.md updated.');

    } catch (e) {
        console.error('ERROR:', e);
    }
}

updateBudgetTable();
