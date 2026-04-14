import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';

const BQ_KEY_FILE = path.resolve('./secrets/crypto-world-epta-2db29829d55d.json');
const spreadsheetId = '1bgnIYA00G70UQJZX3aoSF0-kdra1kceU';

async function inspectColors() {
    const auth = new google.auth.GoogleAuth({
        keyFile: BQ_KEY_FILE,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    console.log('--- INSPECTING COLORS IN SHEETS ---');

    for (const sheetName of ['PFKRIS', 'PFYANA']) {
        console.log(`\nSheet: ${sheetName}`);
        
        // Use spreadsheets.get with ranges and includeGridData: true to get formatting
        const response = await sheets.spreadsheets.get({
            spreadsheetId,
            ranges: [`${sheetName}!A1:A50`],
            includeGridData: true,
        });

        const gridData = response.data.sheets[0].data[0];
        const rowData = gridData.rowData || [];

        rowData.forEach((row, index) => {
            const cell = row.values?.[0];
            const value = cell?.effectiveValue?.stringValue || cell?.effectiveValue?.numberValue;
            const bgColor = cell?.effectiveFormat?.backgroundColor;
            
            if (value && bgColor) {
                // Background color is in R, G, B floats (0 to 1)
                const r = Math.round((bgColor.red || 0) * 255);
                const g = Math.round((bgColor.green || 0) * 255);
                const b = Math.round((bgColor.blue || 0) * 255);
                const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
                console.log(`Row ${index + 1}: Value=${value}, HEX=${hex}, RGB=(${r},${g},${b})`);
            }
        });
    }
}

inspectColors().catch(console.error);
