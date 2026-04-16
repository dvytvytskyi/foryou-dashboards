
'use client';

import React from 'react';
import DashboardPage from '@/components/DashboardPage';
import { PARTNER_CARDS } from '@/lib/partners';
import styles from './partners.module.css';

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
          {PARTNER_CARDS.map(partner => {
            const Icon = partner.icon;
            return (
              <div key={partner.id} className={styles.card} onClick={() => { window.location.href = partner.route; }}>
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
