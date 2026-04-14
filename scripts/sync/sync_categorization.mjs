import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';

const BQ_KEY_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');
const fileId = '1bgnIYA00G70UQJZX3aoSF0-kdra1kceU';

const auth = new google.auth.GoogleAuth({
    keyFile: BQ_KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});

async function processLocalFile() {
    const destPath = path.resolve('./Property_Finder_Source.xlsx');
    console.log('--- PARSING LOCAL EXCEL WITH COLORS ---');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(destPath);

    const reportPath = path.resolve('./pf_listings_report.json');
    if (!fs.existsSync(reportPath)) {
        console.error('Report file not found!');
        return;
    }
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

    workbook.eachSheet(sheet => {
        console.log(`Processing sheet: ${sheet.name}`);
        if (!['PFKRIS', 'PFYANA'].includes(sheet.name.toUpperCase())) return;

        sheet.eachRow((row) => {
            const idCell = row.getCell(1);
            const rawId = idCell.value;
            if (!rawId) return;
            // Strip trailing slashes and spaces
            const idStr = String(rawId).trim().replace(/\//g, '');
            if (idStr.length < 2) return;

            const fill = idCell.fill;
            let color = 'NONE';
            if (fill && fill.type === 'pattern' && fill.fgColor) {
                color = fill.fgColor.argb || 'UNKNOWN';
            }

            let category = 'Other';
            let group = 'Other';

            // Exact Mapping based on scan results
            if (color === 'FF00FF00') {
                category = 'Partner';
                group = 'Partner';
            } else if (color === 'FFFFFF00') {
                category = 'Our Broker';
                group = 'Our';
            } else if (color === 'FFFF0000') {
                category = 'Unpublished';
                group = 'Our';
            } else if (color === 'FF00FFFF') {
                category = 'Abu Dhabi';
                group = 'Our';
            } else if (['FFD5A6BD', 'FFC27BA0', 'FFEAD1DC', 'FFD5A6BD'].includes(color)) {
                category = 'Holiday Homes';
                group = 'Partner';
            }

            // Find matching items in report
            let matchedCount = 0;
            report.forEach(item => {
                const ref = String(item.Reference);
                // Be more specific: either exact match or reference ends with the ID
                if (ref === idStr || ref.endsWith(idStr)) {
                    item.category = category;
                    item.group = group;
                    item.sheet_color = color;
                    matchedCount++;
                }
            });
            
            if (matchedCount > 0) {
                // console.log(`Matched ID ${idStr} (${category}) to ${matchedCount} items.`);
            }
        });
    });

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log('SUCCESS: pf_listings_report.json updated with categories.');
}

processLocalFile().catch(console.error);
