
'use client';

import React, { useEffect, useState } from 'react';
import { User as UserIcon } from 'lucide-react';
import DashboardPage from '@/components/DashboardPage';
import styles from './kanban.module.css';
import LeadSidebar from './LeadSidebar';

const PARTNER_MINIMAL_SIDEBAR = [
  {
    title: 'Партнеры',
    items: [
      { label: 'Klykov', icon: UserIcon, href: '/partners/klykov' },
    ],
  },
];

const COLUMNS = [
  { id: 84853590, name: 'Заявка получена' },
  { id: 84853594, name: 'Взята в работу' },
  { id: 84853930, name: 'Установить контакт' },
  { id: 84853934, name: 'Квалификация' },
  { id: 84853938, name: 'Презентация' },
  { id: 84853946, name: 'Показ' },
  { id: 84853950, name: 'EOI / Чек' },
  { id: 84853954, name: 'Договор' },
  { id: 142, name: 'Оплачено' },
  { id: 143, name: 'Закрито і нереалізовано' },
];

const AMO_USERS: Record<number, string> = {
  8615800: 'Alexey Klykov',
  10190654: 'RED',
  10688694: 'Dima',
  11600198: 'Artem Gerasimov',
  11818326: 'Daniil Nevzorov',
  11830822: 'Radik Pogosyan',
  11954918: 'Гульноза',
  12121046: 'Светлана',
  12195166: 'Кристина',
  12286746: 'Екатерина',
  12443906: 'Камила',
  12522090: 'Валерия',
  12530558: 'Юрий',
  13010230: 'Абдуллаев Руслан',
  13195954: 'Динара',
  13247218: 'Сергей',
  13393038: 'Диана',
};

interface Lead {
  id: number;
  name: string;
  price: number;
  status_id: number;
  created_at: number;
  responsible_user_id: number;
  phone?: string | null;
  tags: string[];
}

export default function KlykovKanban() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch Kanban leads
      const kanbanRes = await fetch('/api/partners/klykov/leads');
      const kanbanJson = await kanbanRes.json();
      if (kanbanJson.success) setLeads(kanbanJson.data);

      // Fetch Marketing stats
      const statsRes = await fetch('/api/marketing?channels=Klykov');
      const statsJson = await statsRes.json();
      if (statsJson.success && statsJson.data.length > 0) {
          // Aggregate all dates
          const totalStats = statsJson.data.reduce((acc: any, curr: any) => ({
              leads: acc.leads + curr.leads,
              qualified_leads: acc.qualified_leads + curr.qualified_leads,
              meetings: acc.meetings + curr.meetings,
              deals: acc.deals + curr.deals,
              revenue: acc.revenue + curr.revenue,
          }), { leads: 0, qualified_leads: 0, meetings: 0, deals: 0, revenue: 0 });
          setStats(totalStats);
      }
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (ts: number) => {
    const d = new Date(ts * 1000);
    const date = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const today = new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    return (date === today ? 'Сегодня' : date) + ' ' + time;
  };

  const formatPrice = (price: number) => {
    const p = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(price).replace(/,/g, ' ');
    return p + ' AED';
  };

  return (
    <DashboardPage 
      title="Klykov CRM Mirror"
      hideTable={true}
      hideSourceFilter={true}
      hideFilters={true}
      hideSidebar={false}
      sidebarSections={PARTNER_MINIMAL_SIDEBAR}
      sidebarMinimal={true}
    >
      <div className={styles.kanbanWrapper}>
        {COLUMNS.map(col => {
          const colLeads = leads
            .filter(l => l.status_id === col.id)
            .sort((a, b) => b.created_at - a.created_at);
          const totalSum = colLeads.reduce((acc, curr) => acc + (curr.price || 0), 0);
          
          return (
            <div key={col.id} className={styles.column}>
              <div className={styles.columnHeader}>
                {loading ? (
                  <>
                    <div className={styles.skeletonTitle} style={{ width: '60%', height: 20, background: 'var(--line)', borderRadius: 4 }} />
                    <div className={styles.skeletonStats} style={{ width: '40%', height: 14, background: 'var(--line)', borderRadius: 4, marginTop: 8 }} />
                  </>
                ) : (
                  <>
                    <div className={styles.columnTitle}>{col.name}</div>
                    <div className={styles.columnStats}>
                      {colLeads.length + ' сделок • ' + formatPrice(totalSum)}
                    </div>
                  </>
                )}
              </div>
              
              <div className={styles.cardsList}>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className={styles.skeletonCard} />
                  ))
                ) : (
                  colLeads.map(lead => (
                    <div 
                      key={lead.id} 
                      className={styles.card}
                      onClick={() => setSelectedLeadId(lead.id)}
                    >
                      <div className={styles.cardHeader}>
                        <div className={styles.cardTime}>{formatDateTime(lead.created_at)}</div>
                        <div className={styles.cardResponsible}>
                          {AMO_USERS[lead.responsible_user_id] || 'Manager'}
                        </div>
                      </div>
                      
                      <div className={styles.cardTitle}>{lead.name}</div>
                      
                      <div className={styles.cardMeta}>
                        {lead.tags.filter(t => t !== 'Klykov leads').map((tag, idx) => (
                          <span key={idx} className={styles.badge}>{tag}</span>
                        ))}
                      </div>

                      <div className={styles.cardFooter}>
                        <div className={styles.cardPhone}>
                          {lead.phone || 'Без номера'}
                        </div>
                        <div className={styles.sourceBadge}>Klykov</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedLeadId && (
        <LeadSidebar 
          leadId={selectedLeadId} 
          onClose={() => setSelectedLeadId(null)} 
          users={AMO_USERS}
        />
      )}
    </DashboardPage>
  );
}
