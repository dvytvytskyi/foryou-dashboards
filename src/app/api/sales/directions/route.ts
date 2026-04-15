import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import ExcelJS from 'exceljs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const parseNumeric = (cell: ExcelJS.Cell): number => {
  const val = cell.value;
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'object' && val !== null && 'result' in val) {
    return Number((val as any).result) || 0;
  }
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^\d.,-]/g, '').replace(',', '.');
    return Number(cleaned) || 0;
  }
  return 0;
};

const parseDate = (val: any): Date | null => {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'string') {
    const parts = val.split(/[./-]/);
    if (parts.length === 3) {
      const d = parseInt(parts[0]);
      const m = parseInt(parts[1]) - 1;
      let y = parseInt(parts[2]);
      if (y < 100) y += 2000;
      const date = new Date(y, m, d);
      return isNaN(date.getTime()) ? null : date;
    }
  }
  return null;
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const startDate = startDateStr ? new Date(startDateStr) : new Date('2024-01-01');
    const endDate = endDateStr ? new Date(endDateStr) : new Date();

    const directions: Record<string, any> = {
      'Первичка': { deals: 0, gmv: 0, revenue: 0, net: 0, total_broker_comm: 0 },
      'Вторичка': { deals: 0, gmv: 0, revenue: 0, net: 0, total_broker_comm: 0 },
      'Аренда': { deals: 0, gmv: 0, revenue: 0, net: 0, total_broker_comm: 0 },
      'Сопровождение': { deals: 0, gmv: 0, revenue: 0, net: 0, total_broker_comm: 0 },
    };

    const sourceStats: Record<string, any> = {};

    const processWorkbook = async (filename: string, sheetSearch: string | number, mapping: any) => {
      const filePath = path.resolve(process.cwd(), filename);
      const workbook = new ExcelJS.Workbook();
      try {
        await workbook.xlsx.readFile(filePath);
        let sheet;
        if (typeof sheetSearch === 'number') {
          sheet = workbook.worksheets[sheetSearch];
        } else {
          sheet = workbook.getWorksheet(sheetSearch) || 
                  workbook.worksheets.find(s => s.name.toLowerCase().replace(/\s/g, '') === sheetSearch.toLowerCase().replace(/\s/g, ''));
        }
        
        if (!sheet) return;

        sheet.eachRow((row, rowNumber) => {
          if (rowNumber <= (mapping.skipRows || 1)) return;
          
          const date = parseDate(row.getCell(mapping.dateCol).value);
          if (!date || date < startDate || date > endDate) return;

          const gmv = parseNumeric(row.getCell(mapping.gmvCol));
          const gross = parseNumeric(row.getCell(mapping.grossCol));
          const net = parseNumeric(row.getCell(mapping.netCol));
          const dirKey = mapping.fixedType;
          const sourceRaw = mapping.fixedSource || String(row.getCell(mapping.sourceCol || 1).value || 'Other');
          
          if (directions[dirKey]) {
            directions[dirKey].deals++;
            directions[dirKey].gmv += gmv;
            directions[dirKey].revenue += gross;
            directions[dirKey].net += net;
            directions[dirKey].total_broker_comm += (gross - net);
          }

          const srcKey = (sourceRaw === '-' || sourceRaw === 'null' || !sourceRaw) ? 'Other' : sourceRaw;
          if (!sourceStats[srcKey]) {
            sourceStats[srcKey] = { name: srcKey, revenue: 0, net: 0, deals: 0, expenses: 0 };
          }
          sourceStats[srcKey].revenue += gross;
          sourceStats[srcKey].net += net;
          sourceStats[srcKey].deals++;
        });
      } catch (e) {
        console.warn(`Could not read ${filename}:`, e);
      }
    };

    await processWorkbook('offplan.xlsx', 'real estate', {
      dateCol: 2, gmvCol: 7, grossCol: 10, netCol: 17, fixedType: 'Первичка', sourceCol: 3
    });

    await processWorkbook('secondary_rental.xlsx', 'Лист 1', {
      dateCol: 1, gmvCol: 6, grossCol: 8, netCol: 15, fixedType: 'Вторичка', sourceCol: 16
    });

    await processWorkbook('secondary_rental.xlsx', 'Лист 2', {
      dateCol: 1, gmvCol: 6, grossCol: 8, netCol: 15, fixedType: 'Аренда', sourceCol: 16, skipRows: 2
    });

    await processWorkbook('support.xlsx', 0, {
      dateCol: 1, gmvCol: 7, grossCol: 9, netCol: 14, fixedType: 'Сопровождение', fixedSource: 'Support'
    });

    // Finalize directions (avg check, broker share)
    Object.keys(directions).forEach(k => {
      const d = directions[k];
      d.avg_check = d.deals > 0 ? d.gmv / d.deals : 0;
      d.broker_share = d.revenue > 0 ? d.total_broker_comm / d.revenue : 0;
    });

    // TODO: Integration with real expenses from Google Sheets
    // For now, we use the values we analyzed from expenses_sheet1.csv
    // In a real scenario, we'd parse the CSV or fetch the sheet.
    try {
      // Mocking expense mapping based on analysis
      if (sourceStats['Secondary']) sourceStats['Secondary'].expenses = 57261.95;
      if (sourceStats['RED']) sourceStats['RED'].expenses = 83676;
      if (sourceStats['Facebook']) sourceStats['Facebook'].expenses = 3281.47;
      if (sourceStats['SMM']) sourceStats['SMM'].expenses = 16500 + 1300;
    } catch (e) {}

    return NextResponse.json({
      success: true,
      directions,
      sources: Object.values(sourceStats).sort((a, b) => b.revenue - a.revenue)
    });

  } catch (error) {
    console.error('Directions API error:', error);
    return NextResponse.json({ success: false, error: 'Internal Error' }, { status: 500 });
  }
}
