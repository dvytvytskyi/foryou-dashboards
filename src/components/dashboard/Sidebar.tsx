'use client';

import React from 'react';
import { 
  PanelLeftClose, 
  PanelLeftOpen, 
  Users,
  LucideIcon 
} from 'lucide-react';
import styles from './Sidebar.module.css';

interface SidebarItem {
  label: string;
  icon: LucideIcon;
  href?: string;
}

interface SidebarSection {
  title: string;
  items: SidebarItem[];
}

interface SidebarProps {
  sidebarCompact: boolean;
  setSidebarCompact: (value: boolean | ((prev: boolean) => boolean)) => void;
  sections: SidebarSection[];
  onLogout?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  sidebarCompact,
  setSidebarCompact,
  sections,
  onLogout
}) => {
  return (
    <aside className={`${styles.sidebar} ${sidebarCompact ? styles.sidebarCompact : ''}`}>
      <div className={styles.sidebarTop}>
        {!sidebarCompact ? <div className={styles.sidebarMainTitle}>Навигация</div> : null}
        <button
          type="button"
          className={styles.sidebarToggle}
          onClick={() => setSidebarCompact((prev) => !prev)}
          aria-label={sidebarCompact ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCompact ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <nav className={styles.sidebarNav}>
        {sections.map((section) => (
          <div key={section.title} className={styles.sidebarSection}>
            {!sidebarCompact ? <div className={styles.sidebarSectionTitle}>{section.title}</div> : null}
            <div className={styles.sidebarItems}>
              {section.items.map((item) => {
                const Icon = item.icon;
                const currentPath = typeof window !== 'undefined' ? window.location.pathname.replace(/\/$/, '') : '';
                const itemHref = item.href?.replace(/\/$/, '') || '';
                const isActive = currentPath === itemHref;
                
                const handleClick = () => {
                  if (item.href && item.href !== '#') {
                    window.location.href = item.href;
                  }
                };

                return (
                  <button
                    key={`${section.title}-${item.label}`}
                    type="button"
                    title={sidebarCompact ? item.label : undefined}
                    className={`${styles.sidebarItem} ${isActive ? styles.sidebarItemActive : ''}`}
                    onClick={handleClick}
                  >
                    <span className={styles.sidebarItemIcon}>
                      <Icon size={18} />
                    </span>
                    {!sidebarCompact ? <span className={styles.sidebarItemLabel}>{item.label}</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className={styles.sidebarBottom}>
        <button 
          type="button"
          className={styles.sidebarItem}
          onClick={onLogout}
        >
          <div className={styles.sidebarItemIcon}>
            <Users size={18} />
          </div>
          {!sidebarCompact && <span className={styles.sidebarItemLabel}>Выйти</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
