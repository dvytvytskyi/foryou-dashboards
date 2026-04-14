import path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';

const excelFile = path.resolve('./Property_Finder_Source.xlsx');
const reportPath = path.resolve('./pf_listings_report.json');

async function syncCategorizationFinal() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelFile);

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

    // Initialize defaults
    report.forEach(item => {
        item.status = item.status || 'Active';
        item.group = item.group || 'Our';
        item.category = item.category || 'Other';
    });

    const stats = {
        kris: { Partner: 0, 'Our Broker': 0, Unpublished: 0, 'Abu Dhabi': 0, 'Holiday Homes': 0, Other: 0 },
        yana: { Partner: 0, 'Our Broker': 0, Unpublished: 0, 'Abu Dhabi': 0, 'Holiday Homes': 0, Other: 0 }
    };

    const getColor = (cell) => {
        const fill = cell.fill;
        if (!fill || !fill.fgColor) return 'NONE';
        
        // If it's a theme color, we might need to map it, but usually it has an ARGB anyway in modern Excel files
        // Let's check ARGB first
        let argb = fill.fgColor.argb;
        
        // Handle theme colors (Yellow in some themes is index 5 or 4)
        if (!argb && fill.fgColor.theme !== undefined) {
             // Basic theme mapping if ARGB is missing
             if (fill.fgColor.theme === 4) return 'FFFFFF00'; // Common yellow theme
             if (fill.fgColor.theme === 5) return 'FF00FF00'; // Common green theme
             return 'THEME_' + fill.fgColor.theme;
        }
        
        return argb || 'NONE';
    };

    const colorMap = (color) => {
        if (color === 'FF00FF00' || color === 'FF92D050' || color === 'FF00B050') return 'Partner';
        if (color === 'FFFFFF00' || color === 'FFFFFF00' || color === 'FFFFFFE0' || color === 'FFFFFF00') return 'Our Broker';
        if (color === 'FFFF0000' || color === 'FFFFC000') return 'Unpublished';
        if (color === 'FF00FFFF' || color === 'FF00B0F0') return 'Abu Dhabi';
        if (['FFD5A6BD', 'FFC27BA0', 'FFEAD1DC', 'FFD5A6BD'].includes(color)) return 'Holiday Homes';
        return 'Other';
    };

    const processSheet = (sheetName, targetKey) => {
        const sheet = workbook.getWorksheet(sheetName);
        if (!sheet) return;

        sheet.eachRow((row, rowNum) => {
            if (rowNum === 1) return;
            const idCell = row.getCell(1);
            const colorCell = row.getCell(2); 
            
            const rawId = idCell.value;
            if (!rawId) return;
            const idStr = String(rawId).trim().replace(/\//g, '');
            if (idStr.length < 2) return;

            const color = getColor(colorCell);
            const category = colorMap(color);
            
            stats[targetKey][category]++;

            report.forEach(item => {
                const ref = String(item.Reference);
                if (ref === idStr || ref.endsWith(idStr)) {
                    item.category = category;
                    item.group = (category === 'Partner' || category === 'Holiday Homes') ? 'Partner' : 'Our';
                    item.status = (category === 'Unpublished') ? 'Archive' : 'Active';
                    item.sheet_source = targetKey;
                }
            });
        });
    };

    processSheet('PFKRIS', 'kris');
    processSheet('PFYANA', 'yana');

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('--- FINAL RECALCULATED STATISTICS ---');
    console.table(stats);
}

syncCategorizationFinal().catch(console.error);
