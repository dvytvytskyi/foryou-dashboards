import path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';

const excelFile = path.resolve('./Property_Finder_Source.xlsx');

async function extractData() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelFile);

    const result = {
        kris: [],
        yana: []
    };

    const colorMap = (color) => {
        if (color === 'FF00FF00') return 'Partner';
        if (color === 'FFFFFF00') return 'Our Broker';
        if (color === 'FFFF0000') return 'Unpublished';
        if (color === 'FF00FFFF') return 'Abu Dhabi';
        if (['FFD5A6BD', 'FFC27BA0', 'FFEAD1DC'].includes(color)) return 'Holiday Homes';
        return 'Other';
    };

    // Process Kris
    const sheetKris = workbook.getWorksheet('PFKRIS');
    if (sheetKris) {
        sheetKris.eachRow((row, rowNum) => {
            if (rowNum === 1) return; // Skip header
            const idCell = row.getCell(1);
            const nameCell = row.getCell(2);
            const rawId = idCell.value;
            if (!rawId) return;

            const color = idCell.fill?.fgColor?.argb || 'NONE';
            result.kris.push({
                id: String(rawId).trim().replace(/\//g, ''),
                project_name: nameCell.value || 'Unknown',
                category: colorMap(color),
                color: color
            });
        });
    }

    // Process Yana
    const sheetYana = workbook.getWorksheet('PFYANA');
    if (sheetYana) {
        sheetYana.eachRow((row, rowNum) => {
            if (rowNum === 1) return; // Skip header
            const idCell = row.getCell(1);
            const nameCell = row.getCell(2);
            const rawId = idCell.value;
            if (!rawId) return;

            const color = idCell.fill?.fgColor?.argb || 'NONE';
            result.yana.push({
                id: String(rawId).trim().replace(/\//g, ''),
                project_name: nameCell.value || 'Unknown',
                category: colorMap(color),
                color: color
            });
        });
    }

    fs.writeFileSync('./extracted_listings.json', JSON.stringify(result, null, 2));
    console.log(`Extracted ${result.kris.length} items for Kris and ${result.yana.length} items for Yana.`);
}

extractData().catch(console.error);
