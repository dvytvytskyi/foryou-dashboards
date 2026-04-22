'use client';

import React, { useEffect, useState, useMemo } from 'react';
import DashboardPage from '@/components/DashboardPage';
import styles from './kanban.module.css';
import LeadSidebar from './LeadSidebar';

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

interface Column {
  id: number;
  name: string;
}

export default function FacebookKanban() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/partners/facebook/leads');
      const json = await res.json();
      if (json.success) {
          setLeads(json.data || []);
          setColumns(json.funnels || []);
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
    const p = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(price || 0).replace(/,/g, ' ');
    return p + ' AED';
  };

  const safeColumns = useMemo(() => columns.filter(c => Number.isFinite(c.id)), [columns]);

  return (
    <DashboardPage 
      title="Facebook CRM Mirror"
      hideTable={true}
      hideSourceFilter={true}
      hideFilters={true}
      hideSidebar={true}
    >
      <div className={styles.kanbanWrapper}>
        {loading && safeColumns.length === 0 ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={styles.column}>
              <div className={styles.columnHeader}>
                <div className={styles.skeletonTitle} style={{ width: '60%', height: 20, background: 'var(--line)', borderRadius: 4 }} />
                <div className={styles.skeletonStats} style={{ width: '40%', height: 14, background: 'var(--line)', borderRadius: 4, marginTop: 8 }} />
              </div>
              <div className={styles.cardsList}>
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className={styles.skeletonCard} />
                ))}
              </div>
            </div>
          ))
        ) : (
          safeColumns.map(col => {
            const colLeads = leads
              .filter(l => l.status_id === col.id)
              .sort((a, b) => b.created_at - a.created_at);
            const totalSum = colLeads.reduce((acc, curr) => acc + (curr.price || 0), 0);
            
            return (
              <div key={col.id} className={styles.column}>
                <div className={styles.columnHeader}>
                  <div className={styles.columnTitle}>{col.name}</div>
                  <div className={styles.columnStats}>
                    {colLeads.length + ' сделок • ' + formatPrice(totalSum)}
                  </div>
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
                          {lead.tags.map((tag, idx) => (
                            <span key={idx} className={styles.badge}>{tag}</span>
                          ))}
                        </div>

                        <div className={styles.cardFooter}>
                          <div className={styles.cardPhone}>
                            {lead.phone || 'Без номера'}
                          </div>
                          <div className={styles.sourceBadge}>Facebook</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })
        )}
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
