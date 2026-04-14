import path from 'path';
import ExcelJS from 'exceljs';

async function scanAllColors() {
    const destPath = path.resolve('./Property_Finder_Source.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(destPath);

    const colors = new Set();

    workbook.eachSheet(sheet => {
        if (!['PFKRIS', 'PFYANA'].includes(sheet.name.toUpperCase())) return;
        sheet.eachRow((row) => {
            const idCell = row.getCell(1);
            const fill = idCell.fill;
            if (fill && fill.type === 'pattern' && fill.fgColor && fill.fgColor.argb) {
                colors.add(fill.fgColor.argb);
            }
        });
    });

    console.log('--- UNIQUE COLORS FOUND ---');
    colors.forEach(c => console.log(c));
}

scanAllColors().catch(console.error);
