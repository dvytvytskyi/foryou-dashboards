'use client';

import React, { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';
import DashboardPage from '@/components/DashboardPage';

const SEO_QUERIES_COLUMNS = [
  { key: 'channel', label: 'Поисковый Запрос (Query)', width: 330, type: 'string' },
  { key: 'impressions', label: 'Показы (Impressions)', width: 180, type: 'number' },
  { key: 'clicks', label: 'Клики (Clicks)', width: 150, type: 'number' },
  { key: 'ctr', label: 'CTR', width: 120, type: 'percent' },
  { key: 'avg_position', label: 'Средняя позиция', width: 160, type: 'number' },
  { key: 'sessions', label: 'Сессии (Organic)', width: 160, type: 'number' },
  { key: 'bounce_rate', label: 'Bounce Rate', width: 140, type: 'percent' },
  { key: 'cr_lead', label: 'Конверсия в Лид (CR)', width: 180, type: 'percent' },
  { key: 'qualified_leads', label: 'Квал. Лиды (QL)', width: 150, type: 'number' },
  { key: 'cr_ql', label: 'CR QL', width: 120, type: 'percent' },
  { key: 'budget', label: 'Объем работ/Стоимость', width: 220, type: 'number' },
  { key: 'revenue', label: 'Потенциальный Revenue', width: 190, type: 'money' },
  { key: 'status', label: 'Примечания/Статус', width: 200, type: 'string' },
];

const SEO_PAGES_COLUMNS = [
  { key: 'channel', label: 'Целевая страница (Landing Page)', width: 330, type: 'string' },
  { key: 'impressions', label: 'Показы (Impressions)', width: 180, type: 'number' },
  { key: 'clicks', label: 'Клики (Clicks)', width: 150, type: 'number' },
  { key: 'ctr', label: 'CTR', width: 120, type: 'percent' },
  { key: 'avg_position', label: 'Средняя позиция', width: 160, type: 'number' },
  { key: 'sessions', label: 'Сессии (Organic)', width: 160, type: 'number' },
  { key: 'bounce_rate', label: 'Bounce Rate', width: 140, type: 'percent' },
  { key: 'cr_lead', label: 'Конверсия в Лид (CR)', width: 180, type: 'percent' },
  { key: 'qualified_leads', label: 'Квал. Лиды (QL)', width: 150, type: 'number' },
  { key: 'cr_ql', label: 'CR QL', width: 120, type: 'percent' },
  { key: 'budget', label: 'Стоимость', width: 140, type: 'number' },
  { key: 'revenue', label: 'Потенциальный Revenue', width: 190, type: 'money' },
  { key: 'status', label: 'Примечания/Статус', width: 200, type: 'string' },
];

export default function SeoTable({ startDate, endDate }: { startDate: string, endDate: string }) {
    const [loading, setLoading] = useState(true);
    const [queries, setQueries] = useState<any[]>([]);
    const [pages, setPages] = useState<any[]>([]);

    useEffect(() => {
        setLoading(true);
        fetch(`/api/marketing/website/seo?startDate=${startDate}&endDate=${endDate}`)
            .then(res => res.json())
            .then(res => {
                if (res.success) {
                    const mapRow = (row: any) => ({
                        channel: row.grouping,
                        level_1: null, level_2: null, level_3: null,
                        date: '-',
                        budget: row.cost || 0,
                        leads: 0, cpl: 0, no_answer_spam: 0, rate_answer: 0,
                        cr_ql: row.leads_crm > 0 ? row.qualified_leads / row.leads_crm : 0,
                        ql_actual: 0, cpql_actual: 0, meetings: 0, cp_meetings: 0, deals: 0, cost_per_deal: 0, roi: 0, company_revenue: 0, sort_order: 0,
                        // Custom SEO keys
                        impressions: row.impressions,
                        clicks: row.clicks,
                        ctr: row.ctr,
                        avg_position: Math.round(row.avg_position), // DataTable only formats ints properly
                        sessions: row.sessions,
                        bounce_rate: row.bounce_rate,
                        leads_crm: row.leads_crm,
                        qualified_leads: row.qualified_leads,
                        cr_lead: row.sessions > 0 ? row.leads_crm / row.sessions : 0,
                        revenue: row.revenue,
                        status: row.status
                    });
                    
                    setQueries(res.data.queries.map(mapRow));
                    setPages(res.data.pages.map(mapRow));
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [startDate, endDate]);

    return (
        <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <DashboardPage 
                isNested={true}
                isLoading={loading}
                title="Поисковые Запросы (Queries)"
                icon={<Globe size={18} />}
                hideFilters={true}
                hideSidebar={true}
                hideTotal={true}
                disableUppercaseChannel={true}
                customColumns={SEO_QUERIES_COLUMNS}
                firstColumnLabel="Поисковый Запрос (Query)"
                initialRows={queries}
                tableMinWidth="1800px"
            />
        </div>
    );
}
