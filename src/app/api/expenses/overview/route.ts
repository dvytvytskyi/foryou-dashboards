import { NextRequest, NextResponse } from 'next/server';
import { readExpensesMonthlyRecords, MonthlyExpenseRecord } from '@/lib/sheets/expensesReader';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ExpenseKey = 'salary' | 'bases' | 'accountants' | 'marketing' | 'maintenance' | 'other';

type DetailPoint = {
  periodKey: string;
  monthLabel: string;
  value: number;
  income?: number;
  expense?: number;
  shareOfExpense?: number;
};

function monthRange(startDate: string, endDate: string): Set<string> {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const out = new Set<string>();

  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  while (cursor <= last) {
    const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`;
    out.add(key);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return out;
}

function sum(numbers: number[]) {
  return numbers.reduce((acc, value) => acc + value, 0);
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function pctDelta(current: number, previous: number) {
  if (!previous) return 0;
  return round2(((current - previous) / previous) * 100);
}

function findByOffset(records: MonthlyExpenseRecord[], base: MonthlyExpenseRecord, offset: number) {
  const date = new Date(Date.UTC(base.year, base.month - 1, 1));
  date.setUTCMonth(date.getUTCMonth() + offset);
  const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  return records.find((r) => r.periodKey === key) || null;
}

function categoryCurrent(record: MonthlyExpenseRecord, key: ExpenseKey) {
  return record.expenses[key] || 0;
}

function monthLabel(periodKey: string) {
  const [year, month] = periodKey.split('-');
  return `${month}.${year}`;
}

function sharePct(part: number, total: number) {
  if (!total) return 0;
  return round2((part / total) * 100);
}

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams;
    const startDate = search.get('startDate') || '2024-01-01';
    const endDate = search.get('endDate') || new Date().toISOString().slice(0, 10);

    const allRecords = await readExpensesMonthlyRecords();
    const range = monthRange(startDate, endDate);
    const records = allRecords.filter((r) => range.has(r.periodKey));

    if (!records.length) {
      return NextResponse.json({
        success: true,
        data: {
          incomeRows: [],
          summaryRows: [],
          expenseDetails: [],
          result: 0,
          totalIncome: 0,
          totalExpense: 0,
          meta: { startDate, endDate, months: 0 },
        },
      });
    }

    const latest = records[records.length - 1];

    const incomeAgg = {
      partners: { deals: 0, income: 0 },
      realEstate: { deals: 0, income: 0 },
      cb: { deals: 0, income: 0 },
    };

    for (const record of records) {
      incomeAgg.partners.deals += record.departments.partners.deals;
      incomeAgg.partners.income += record.departments.partners.income;
      incomeAgg.realEstate.deals += record.departments.realEstate.deals;
      incomeAgg.realEstate.income += record.departments.realEstate.income;
      incomeAgg.cb.deals += record.departments.cb.deals;
      incomeAgg.cb.income += record.departments.cb.income;
    }

    const totalIncome = incomeAgg.partners.income + incomeAgg.realEstate.income + incomeAgg.cb.income;
    const totalDeals = incomeAgg.partners.deals + incomeAgg.realEstate.deals + incomeAgg.cb.deals;

    const incomeRows = [
      { type: 'Партнерский отдел', deals: incomeAgg.partners.deals, income: round2(incomeAgg.partners.income) },
      { type: 'Real Estate', deals: incomeAgg.realEstate.deals, income: round2(incomeAgg.realEstate.income) },
      { type: 'СB', deals: incomeAgg.cb.deals, income: round2(incomeAgg.cb.income) },
      { type: 'ИТОГО', deals: totalDeals, income: round2(totalIncome), isTotal: true },
    ];

    const expenseRows = [
      { category: 'Зарплата', key: 'salary' as ExpenseKey },
      { category: 'Базы недвижимости', key: 'bases' as ExpenseKey },
      { category: 'Бухгалтера', key: 'accountants' as ExpenseKey },
      { category: 'Маркетинг', key: 'marketing' as ExpenseKey },
      { category: 'Обслуживание', key: 'maintenance' as ExpenseKey },
      { category: 'Другое', key: 'other' as ExpenseKey },
    ];

    const summaryRows = expenseRows.map((row) => ({
      category: row.category,
      amount: round2(sum(records.map((r) => r.expenses[row.key]))),
    }));

    const totalExpense = round2(sum(summaryRows.map((r) => r.amount)));
    const result = round2(totalIncome - totalExpense);

    const previousMonth = findByOffset(allRecords, latest, -1);
    const threeMonthsAgo = findByOffset(allRecords, latest, -3);
    const twelveMonthsAgo = findByOffset(allRecords, latest, -12);

    function buildDynamicsFor(currentValue: number, key: ExpenseKey) {
      const prevValue = previousMonth ? categoryCurrent(previousMonth, key) : 0;
      const qValue = threeMonthsAgo ? categoryCurrent(threeMonthsAgo, key) : 0;
      const yValue = twelveMonthsAgo ? categoryCurrent(twelveMonthsAgo, key) : 0;
      return {
        mom: pctDelta(currentValue, prevValue),
        qoq: pctDelta(currentValue, qValue),
        yoy: pctDelta(currentValue, yValue),
      };
    }

    const expenseDetails = expenseRows.map((row) => {
      const current = round2(categoryCurrent(latest, row.key));
      const avg = round2(sum(records.map((r) => r.expenses[row.key])) / records.length);
      const details: DetailPoint[] = records.map((record) => {
        const value = round2(record.expenses[row.key]);
        const monthlyExpense = round2(record.expenses.total);
        return {
          periodKey: record.periodKey,
          monthLabel: monthLabel(record.periodKey),
          value,
          expense: monthlyExpense,
          shareOfExpense: sharePct(value, monthlyExpense),
        };
      });

      return {
        name: row.category,
        current,
        average: avg,
        ...buildDynamicsFor(current, row.key),
        details,
      };
    });

    const currentTotalExpense = round2(latest.expenses.total);
    const currentIncome = round2(
      latest.departments.partners.income + latest.departments.realEstate.income + latest.departments.cb.income,
    );
    const currentResult = round2(currentIncome - currentTotalExpense);

    const prevExpense = previousMonth ? round2(previousMonth.expenses.total) : 0;
    const qExpense = threeMonthsAgo ? round2(threeMonthsAgo.expenses.total) : 0;
    const yExpense = twelveMonthsAgo ? round2(twelveMonthsAgo.expenses.total) : 0;
    const prevResult = previousMonth
      ? round2(
          previousMonth.departments.partners.income +
            previousMonth.departments.realEstate.income +
            previousMonth.departments.cb.income -
            previousMonth.expenses.total,
        )
      : 0;
    const qResult = threeMonthsAgo
      ? round2(
          threeMonthsAgo.departments.partners.income +
            threeMonthsAgo.departments.realEstate.income +
            threeMonthsAgo.departments.cb.income -
            threeMonthsAgo.expenses.total,
        )
      : 0;
    const yResult = twelveMonthsAgo
      ? round2(
          twelveMonthsAgo.departments.partners.income +
            twelveMonthsAgo.departments.realEstate.income +
            twelveMonthsAgo.departments.cb.income -
            twelveMonthsAgo.expenses.total,
        )
      : 0;

    const avgMonthlyExpense = round2(sum(records.map((r) => r.expenses.total)) / records.length);
    const avgMonthlyResult = round2(
      sum(
        records.map(
          (r) => r.departments.partners.income + r.departments.realEstate.income + r.departments.cb.income - r.expenses.total,
        ),
      ) / records.length,
    );

    const totalExpenseDetails: DetailPoint[] = records.map((record) => {
      const income = round2(
        record.departments.partners.income + record.departments.realEstate.income + record.departments.cb.income,
      );
      const expense = round2(record.expenses.total);
      return {
        periodKey: record.periodKey,
        monthLabel: monthLabel(record.periodKey),
        value: expense,
        income,
        expense,
        shareOfExpense: 100,
      };
    });

    expenseDetails.unshift({
      name: 'Сумма расхода',
      current: currentTotalExpense,
      average: avgMonthlyExpense,
      mom: pctDelta(currentTotalExpense, prevExpense),
      qoq: pctDelta(currentTotalExpense, qExpense),
      yoy: pctDelta(currentTotalExpense, yExpense),
      isTotal: true,
      details: totalExpenseDetails,
    });

    const resultDetails: DetailPoint[] = records.map((record) => {
      const income = round2(
        record.departments.partners.income + record.departments.realEstate.income + record.departments.cb.income,
      );
      const expense = round2(record.expenses.total);
      return {
        periodKey: record.periodKey,
        monthLabel: monthLabel(record.periodKey),
        value: round2(income - expense),
        income,
        expense,
      };
    });

    expenseDetails.push({
      name: 'Доход компании (доход - расход)',
      current: currentResult,
      average: avgMonthlyResult,
      mom: pctDelta(currentResult, prevResult),
      qoq: pctDelta(currentResult, qResult),
      yoy: pctDelta(currentResult, yResult),
      isResult: true,
      details: resultDetails,
    });

    return NextResponse.json({
      success: true,
      data: {
        incomeRows,
        summaryRows,
        expenseDetails,
        result,
        totalIncome: round2(totalIncome),
        totalExpense,
        meta: {
          startDate,
          endDate,
          months: records.length,
          latestMonth: latest.periodKey,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load expenses overview',
      },
      { status: 500 },
    );
  }
}
