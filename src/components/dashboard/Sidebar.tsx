'use client';

import React from 'react';
import { 
  PanelLeftClose, 
  PanelLeftOpen, 
  Users,
  Search,
  LucideIcon,
  ChevronDown,
  User as UserIcon,
  BarChart,
  Target
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
  sections: SidebarSection[];
  onLogout?: () => void;
  user?: any;
}

const Sidebar: React.FC<SidebarProps> = ({
  sections,
  onLogout,
  user
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const displayName = user?.name || 'Guest User';
  const displayRole = user?.role === 'admin' ? 'Administrator' : 'Agency Partner';

  // Mapping is no longer needed since we updated the source NAVIGATION_SECTIONS directly
  // But we still handle filter logic locally
  const filteredSections = React.useMemo(() => {
    return sections.map(s => ({
      ...s,
      items: s.items.filter(item => 
        item.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    })).filter(s => s.items.length > 0);
  }, [sections, searchTerm]);

  return (
    <aside className={styles.sidebar}>
      {/* User Profile Header */}
      <div className={styles.sidebarProfile}>
        <div className={styles.profileCard}>
          <div className={styles.profileAvatar}>
            <div 
              style={{ 
                width: '100%', 
                height: '100%', 
                background: 'var(--panel)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--white-soft)',
                fontSize: '13px',
                fontWeight: '700'
              }}
            >
              {getInitials(displayName)}
            </div>
          </div>
          <div className={styles.profileInfo}>
            <div className={styles.profileName}>{displayName}</div>
            <div className={styles.profileRole}>{displayRole}</div>
          </div>
          <ChevronDown size={14} color="var(--muted)" />
        </div>
      </div>

      {/* Search Bar */}
      <div className={styles.sidebarSearch}>
        <div className={styles.searchWrapper}>
          <Search size={14} className={styles.searchIcon} />
          <input 
            type="text" 
            placeholder="Search" 
            className={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className={styles.searchShortcut}>⌘F</span>
        </div>
      </div>

      <nav className={styles.sidebarNav}>
        {filteredSections.map((section) => (
          <div key={section.title} className={styles.sidebarSection}>
            <div className={styles.sidebarSectionTitle}>
              {section.title}
            </div>
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
                    className={`${styles.sidebarItem} ${isActive ? styles.sidebarItemActive : ''}`}
                    onClick={handleClick}
                  >
                    <span className={styles.sidebarItemIcon}>
                      <Icon size={16} />
                    </span>
                    <span className={styles.sidebarItemLabel}>{item.label}</span>
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
          onClick={() => window.location.href = '/profile'}
        >
          <div className={styles.sidebarItemIcon}>
            <UserIcon size={16} />
          </div>
          <span className={styles.sidebarItemLabel}>Account</span>
        </button>
        <button 
          type="button"
          className={styles.sidebarItem}
          style={{ color: 'var(--negative)' }}
          onClick={onLogout}
        >
          <div className={styles.sidebarItemIcon} style={{ color: 'inherit' }}>
            <Target size={16} />
          </div>
          <span className={styles.sidebarItemLabel}>Выйти</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
