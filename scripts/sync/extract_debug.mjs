import path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';

const excelFile = path.resolve('./Property_Finder_Source.xlsx');

async function extractFullData() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelFile);

    const result = { kris: [], yana: [] };

    const process = (sheetName, target) => {
        const sheet = workbook.getWorksheet(sheetName);
        if (!sheet) return;
        sheet.eachRow((row, i) => {
            if (i === 1) return;
            const id = row.getCell(1).value;
            const project = row.getCell(2).value;
            const color = row.getCell(2).fill?.fgColor?.argb || 'NONE';
            if (id) {
                target.push({ id, project, color });
            }
        });
    };

    process('PFKRIS', result.kris);
    process('PFYANA', result.yana);

    fs.writeFileSync('./extracted_listings_debug.json', JSON.stringify(result, null, 2));
    console.log('Generated extracted_listings_debug.json');
}

extractFullData().catch(console.error);
