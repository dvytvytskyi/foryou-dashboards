import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

async function generateBrokerMapping() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('Property_Finder_Source.xlsx');
    
    const mapping = {}; // Name -> 'Our' | 'Partner'
    
    const getColor = (cell) => {
        const fill = cell.fill;
        if (!fill || !fill.fgColor) return 'NONE';
        return fill.fgColor.argb || 'NONE';
    };

    const colorMap = (color) => {
        if (color === 'FF00FF00' || color === 'FF92D050' || color === 'FF00B050') return 'Partner';
        if (color === 'FFFFFF00') return 'Our'; // Yellow
        if (['FFD5A6BD', 'FFC27BA0', 'FFEAD1DC'].includes(color)) return 'Partner'; // Pink
        return 'Our'; // Default to Our for Red/Blue/Other
    };

    // Helper to normalize names (basic)
    const normalize = (name) => {
        if (!name) return '';
        return String(name).trim().toLowerCase();
    };

    ['PFKRIS', 'PFYANA'].forEach(s => {
        const sheet = workbook.getWorksheet(s);
        sheet.eachRow((row, i) => {
            if (i === 1) return;
            const color = getColor(row.getCell(2));
            const group = colorMap(color);
            const broker = row.getCell(7).value;
            if (broker && typeof broker === 'string') {
                mapping[normalize(broker)] = group;
            }
        });
    });

    // Manual additions for common CRM names if different from Excel
    const manualAdditions = {
        'екатерина спицына': 'Our',
        'валерия богданова': 'Our',
        'абдуллаев руслан': 'Our',
        'радик': 'Our',
        'radik pogosyan': 'Our',
        'кристина нохрина': 'Our',
        'ирина кольчугина': 'Our',
        'диана рустам кызы': 'Our',
        'диана рустам': 'Our',
        'светлана': 'Our',
        'камила евстегнеева': 'Our',
        'daniil nevzorov': 'Our',
        'сергей зубкевич': 'Our'
    };

    Object.assign(mapping, manualAdditions);

    fs.writeFileSync('broker_mapping.json', JSON.stringify(mapping, null, 2));
    console.log('Broker mapping generated successfully with ' + Object.keys(mapping).length + ' entries.');
}

generateBrokerMapping().catch(console.error);
