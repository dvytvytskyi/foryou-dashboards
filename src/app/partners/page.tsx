
'use client';

import React from 'react';
import DashboardPage from '@/components/DashboardPage';
import styles from './partners.module.css';
import { User, ShieldCheck, Zap } from 'lucide-react';

const PARTNERS = [
  {
    id: 'klykov',
    name: 'Klykov',
    leads: '1,245',
    deals: '42',
    revenue: 'AED 450,000',
    type: 'amoCRM Integration',
    status: 'Active',
    icon: User
  },
  {
    id: 'red',
    name: 'RED',
    leads: '5,824',
    deals: '124',
    revenue: 'AED 1,240,541',
    type: 'External Agency',
    status: 'Active',
    icon: Zap
  },
  {
    id: 'target-point',
    name: 'Target Point',
    leads: '850',
    deals: '15',
    revenue: 'AED 180,000',
    type: 'Facebook / Target',
    status: 'Active',
    icon: ShieldCheck
  }
];

export default function PartnersPage() {
  return (
    <DashboardPage 
      title="Партнеры"
      hideTable={true}
      hideSourceFilter={true}
      hideFilters={true}
    >
      <div className={styles.container}>
        <div className={styles.grid}>
          {PARTNERS.map(partner => {
            const Icon = partner.icon;
            const handleClick = () => {
              if (partner.id === 'klykov') {
                window.location.href = '/partners/klykov';
              } else {
                alert('Coming soon...');
              }
            };
            return (
              <div key={partner.id} className={styles.card} onClick={handleClick}>
                <div className={styles.status + ' ' + styles.statusActive}>
                  {partner.status}
                </div>
                <div className={styles.cardIcon}>
                  <Icon size={24} />
                </div>
                <div className={styles.partnerName}>{partner.name}</div>
                <div className={styles.partnerInfo}>
                  <div className={styles.infoItem}>
                    <span className={styles.label}>Type</span>
                    <span className={styles.value}>{partner.type}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.label}>Total Leads</span>
                    <span className={styles.value}>{partner.leads}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.label}>Revenue</span>
                    <span className={styles.value}>{partner.revenue}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardPage>
  );
}
