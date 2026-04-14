import path from 'path';
import ExcelJS from 'exceljs';

async function findValues() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('./Property_Finder_Source.xlsx');
    
    workbook.eachSheet(sheet => {
        sheet.eachRow((row, i) => {
            const rowText = row.values.join('|');
            if (rowText.includes('661.55') || rowText.includes('95.000')) {
                const colorB = row.getCell(2).fill?.fgColor?.argb;
                console.log(`Match in sheet "${sheet.name}" Row ${i}: colorB=${colorB}, data=${rowText}`);
            }
        });
    });
}

findValues().catch(console.error);
