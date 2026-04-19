import { NextRequest, NextResponse } from 'next/server';
import { amoFetch } from '@/lib/amo';

const ACCOUNTING_PIPELINE_ID = 10633834;
const STATUS_INVOICE_ISSUED = 83955706;
const STATUS_NEW_DEAL = 83827322;

// Amo custom field IDs in "Бухгалтерия" pipeline.
const CF_BOOKING_DATE = 1343897;
const CF_UNIT_PRICE = 1343899;
const CF_DEV_COMMISSION_PERCENT = 1343901;
const CF_BROKER = 1343903;
const CF_BROKER_PERCENT = 1343907;
const CF_BROKER_COMMISSION = 1343909;
const CF_COMMISSION_AED_LEGACY = 703127;

type InvoiceLead = {
  id: number;
  name?: string;
  status_id?: number;
  created_at?: number;
  custom_fields_values?: Array<{ field_id?: number; values?: Array<{ value?: unknown }> }>;
};

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const normalized = value.replace(/\s+/g, '').replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function getCustomFieldValue(lead: InvoiceLead, fieldId: number): unknown {
  const field = (lead.custom_fields_values || []).find((f) => f.field_id === fieldId);
  return field?.values?.[0]?.value;
}

function getLeadDateUnix(lead: InvoiceLead): number {
  const booking = toNumber(getCustomFieldValue(lead, CF_BOOKING_DATE));
  if (booking > 0) return booking;
  return toNumber(lead.created_at);
}

function buildFinancials(lead: InvoiceLead): { grossCommission: number; companyIncome: number } {
  const directGross = toNumber(getCustomFieldValue(lead, CF_COMMISSION_AED_LEGACY));
  const unitPrice = toNumber(getCustomFieldValue(lead, CF_UNIT_PRICE));
  const devPercent = toNumber(getCustomFieldValue(lead, CF_DEV_COMMISSION_PERCENT));
  const brokerPercent = toNumber(getCustomFieldValue(lead, CF_BROKER_PERCENT));
  const brokerCommission = toNumber(getCustomFieldValue(lead, CF_BROKER_COMMISSION));

  const grossByFormula = unitPrice > 0 && devPercent > 0 ? unitPrice * (devPercent / 100) : 0;
  const grossCommission = directGross > 0 ? directGross : grossByFormula;

  let companyIncome = 0;
  if (grossCommission > 0 && brokerCommission > 0) {
    companyIncome = grossCommission - brokerCommission;
  } else if (grossCommission > 0 && brokerPercent > 0 && brokerPercent <= 100) {
    companyIncome = grossCommission * (1 - brokerPercent / 100);
  }

  return {
    grossCommission: Math.max(0, grossCommission),
    companyIncome: Math.max(0, companyIncome),
  };
}

function inRange(unixSec: number, startTs: number, endTs: number): boolean {
  if (!unixSec) return false;
  return unixSec >= startTs && unixSec <= endTs;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

async function fetchAllAccountingLeads(): Promise<InvoiceLead[]> {
  const out: InvoiceLead[] = [];
  const limit = 250;
  let page = 1;

  while (true) {
    const query = `/api/v4/leads?filter[pipeline_id]=${ACCOUNTING_PIPELINE_ID}&limit=${limit}&page=${page}`;
    const res = await amoFetch(query);
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`AmoCRM error (${res.status}): ${err}`);
    }

    const json = await res.json();
    const leads = (json?._embedded?.leads || []) as InvoiceLead[];
    out.push(...leads);

    if (leads.length < limit) break;
    page += 1;
  }

  return out;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate') || '2024-01-01';
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];

    const startTs = Math.floor(new Date(`${startDate}T00:00:00Z`).getTime() / 1000);
    const endTs = Math.floor(new Date(`${endDate}T23:59:59Z`).getTime() / 1000);

    const allLeads = await fetchAllAccountingLeads();
    const leadsInRange = allLeads.filter((lead) => inRange(getLeadDateUnix(lead), startTs, endTs));

    const shortLeads = leadsInRange.filter((lead) => lead.status_id === STATUS_INVOICE_ISSUED);
    const longLeads = leadsInRange.filter((lead) => lead.status_id === STATUS_NEW_DEAL);

    const short = shortLeads.reduce(
      (acc, lead) => {
        const f = buildFinancials(lead);
        acc.totalCommission += f.grossCommission;
        acc.companyRemainder += f.companyIncome;
        acc.invoiceCount += 1;
        return acc;
      },
      { totalCommission: 0, invoiceCount: 0, companyRemainder: 0 },
    );

    const long = longLeads.reduce(
      (acc, lead) => {
        const f = buildFinancials(lead);
        acc.totalCommission += f.grossCommission;
        acc.companyRemainder += f.companyIncome;
        acc.invoiceCount += 1;
        return acc;
      },
      { totalCommission: 0, invoiceCount: 0, companyRemainder: 0 },
    );

    const shortTableRows = shortLeads
      .map((lead) => {
        const f = buildFinancials(lead);
        return {
          id: lead.id,
          brokerName: String(getCustomFieldValue(lead, CF_BROKER) || '-'),
          invoiceTitle: lead.name || '-',
          companyIncome: round2(f.companyIncome),
        };
      })
      .sort((a, b) => b.companyIncome - a.companyIncome);

    const longTableRows = longLeads
      .map((lead) => {
        const f = buildFinancials(lead);
        return {
          id: lead.id,
          brokerName: String(getCustomFieldValue(lead, CF_BROKER) || '-'),
          invoiceTitle: lead.name || '-',
          companyIncome: round2(f.companyIncome),
        };
      })
      .sort((a, b) => b.companyIncome - a.companyIncome);

    return NextResponse.json({
      success: true,
      data: {
        short: {
          totalCommission: round2(short.totalCommission),
          invoiceCount: short.invoiceCount,
          companyRemainder: round2(short.companyRemainder),
          tableRows: shortTableRows,
        },
        long: {
          totalCommission: round2(long.totalCommission),
          invoiceCount: long.invoiceCount,
          companyRemainder: round2(long.companyRemainder),
          tableRows: longTableRows,
        },
        meta: {
          pipelineId: ACCOUNTING_PIPELINE_ID,
          shortStatusId: STATUS_INVOICE_ISSUED,
          longStatusIds: [STATUS_NEW_DEAL],
        },
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load invoices overview';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
