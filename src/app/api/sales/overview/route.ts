import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
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

    const scoreboard = { closed_deals: 0, gmv: 0, gross_commission: 0, net_profit: 0 };
    const brokerMap: Record<string, any> = {};
    const partnerMap: Record<string, any> = {};
    const typeMap: Record<string, number> = {};
    const sourceMap: Record<string, number> = {};
    const rawDeals: any[] = [];
    const supportMap: Record<string, any> = {
      'KRIS': { name: 'Крис', deals: 0, fee: 0, revenue: 0, color: '#6366f1' },
      'YANA': { name: 'Яна', deals: 0, fee: 0, revenue: 0, color: '#ec4899' },
    };

    const normalizeName = (name: string): string => {
      const n = name.toUpperCase().trim();
      if (n.includes('KRIS') || n.includes('КРИСТ') || n.includes('КРІСТ')) return 'KRIS';
      if (n.includes('YANA') || n.includes('ЯНА')) return 'YANA';
      return n;
    };

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
          const brokerRaw = String(row.getCell(mapping.brokerCol).value || 'Unknown');
          const brokerNormalized = normalizeName(brokerRaw);
          const partner = mapping.partnerCol ? String(row.getCell(mapping.partnerCol).value || '-').trim() : '-';
          const type = mapping.fixedType;
          const sourceRaw = mapping.fixedSource || String(row.getCell(mapping.sourceCol || 1).value || 'Other');
          const info = row.getCell(mapping.infoCol || 2).value ? String(row.getCell(mapping.infoCol || 2).value) : '-';

          rawDeals.push({
            date: date.toISOString().split('T')[0],
            broker: brokerRaw,
            partner: partner === 'null' ? '-' : partner,
            gmv,
            gross,
            net,
            type,
            source: sourceRaw,
            info: info.substring(0, 100),
            id: `${filename}-${sheet.name}-${rowNumber}`
          });

          scoreboard.closed_deals++;
          scoreboard.gmv += gmv;
          scoreboard.gross_commission += gross;
          scoreboard.net_profit += net;

          const displayBroker = (brokerNormalized === 'KRIS') ? 'Кристина' : (brokerNormalized === 'YANA' ? 'Яна' : brokerRaw);
          if (!brokerMap[displayBroker]) {
            brokerMap[displayBroker] = { broker_name: displayBroker, gross_revenue: 0, net_profit: 0, deals: 0 };
          }
          brokerMap[displayBroker].gross_revenue += gross;
          brokerMap[displayBroker].net_profit += net;
          brokerMap[displayBroker].deals++;

          if (supportMap[brokerNormalized]) {
            supportMap[brokerNormalized].deals++;
            supportMap[brokerNormalized].fee += gross;
            supportMap[brokerNormalized].revenue += net;
          }

          if (partner && partner !== '-' && partner !== 'Unknown' && partner !== 'null') {
            if (!partnerMap[partner]) partnerMap[partner] = { name: partner, revenue: 0, deals: 0 };
            partnerMap[partner].revenue += net;
            partnerMap[partner].deals++;
          }

          typeMap[type] = (typeMap[type] || 0) + net;
          const srcKey = (sourceRaw === '-' || sourceRaw === 'null') ? 'Other' : sourceRaw;
          sourceMap[srcKey] = (sourceMap[srcKey] || 0) + net;
        });
      } catch (e) {
        console.warn(`Could not read ${filename}:`, e);
      }
    };

    await processWorkbook('offplan.xlsx', 'real estate', {
      dateCol: 2, brokerCol: 5, partnerCol: 6, gmvCol: 7, grossCol: 10, netCol: 17, fixedType: 'Offplan', sourceCol: 3, infoCol: 4
    });

    await processWorkbook('secondary_rental.xlsx', 'Лист 1', {
      dateCol: 1, brokerCol: 3, partnerCol: 4, gmvCol: 6, grossCol: 8, netCol: 15, fixedType: 'Вторичка', sourceCol: 16, infoCol: 2
    });

    await processWorkbook('secondary_rental.xlsx', 'Лист 2', {
      dateCol: 1, brokerCol: 3, partnerCol: 4, gmvCol: 6, grossCol: 8, netCol: 15, fixedType: 'Аренда', sourceCol: 16, skipRows: 2, infoCol: 2
    });

    await processWorkbook('support.xlsx', 0, {
      dateCol: 1, brokerCol: 6, partnerCol: 4, gmvCol: 7, grossCol: 9, netCol: 14, fixedType: 'Сопровождение', fixedSource: 'Сопровождение', infoCol: 2
    });

    const totalNet = scoreboard.net_profit || 1;
    const typeColors: Record<string, string> = {
      'Offplan': 'var(--white-soft)',
      'Вторичка': '#94a3b8',
      'Аренда': '#64748b',
      'Сопровождение': '#475569'
    };

    const types = Object.entries(typeMap).map(([label, value]) => ({
      label,
      value: Math.round((value / totalNet) * 100),
      color: typeColors[label] || 'var(--muted)'
    }));

    const departments = Object.entries(sourceMap)
      .map(([label, value]) => ({
        label: label === 'PF' ? 'Property Finder' : (['PARTNERSHIP', 'PARTNER'].includes(label.toUpperCase()) ? 'Партнеры' : label),
        value: value,
        share: Math.round((value / totalNet) * 100),
        color: label === 'PF' ? 'var(--white-soft)' : 'var(--muted)'
      }))
      .sort((a, b) => b.value - a.value);

    const brokers = Object.values(brokerMap).sort((a, b) => b.net_profit - a.net_profit);
    const partners = Object.values(partnerMap).sort((a, b) => b.revenue - a.revenue);

    return NextResponse.json({
      success: true,
      scoreboard,
      brokers,
      partners,
      types,
      departments,
      deals: rawDeals.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      support: Object.values(supportMap),
      meta: { startDate, endDate }
    });
  } catch (error) {
    console.error('Sales Overview API error:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown' }, { status: 500 });
  }
}
