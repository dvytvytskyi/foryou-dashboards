'use client';

import React from 'react';
import { Moon, Sun } from 'lucide-react';
import styles from './Header.module.css';

interface HeaderProps {
  themeMode: 'night' | 'light';
  setThemeMode: (mode: 'night' | 'light' | ((prev: 'night' | 'light') => 'night' | 'light')) => void;
  title?: string;
  // Kept props for compatibility if needed, but not using search UI
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
}

const Header: React.FC<HeaderProps> = ({
  themeMode,
  setThemeMode,
  title = 'Performance Report'
}) => {
  return (
    <div className={styles.topRail}>
      <div className={styles.headerLeft}>
        <div className={styles.breadcrumbs}>
          <span className={styles.breadcrumbMuted}>Dashboard</span>
          <span className={styles.breadcrumbSeparator}>/</span>
          <span className={styles.breadcrumbActive}>{title}</span>
        </div>
      </div>
      
      <div className={styles.headerRight}>
        <div className={styles.headerSwitchWrap}>
          <button
            type="button"
            className={`${styles.themeSwitch} ${themeMode === 'light' ? styles.themeSwitchLight : ''}`}
            onClick={() => setThemeMode((prev: any) => (prev === 'night' ? 'light' : 'night'))}
            aria-label={themeMode === 'night' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={themeMode === 'night' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            <span className={styles.themeSwitchTrack}>
              <span className={styles.themeSwitchIcon}>
                {themeMode === 'night' ? <Moon size={13} /> : <Sun size={13} />}
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Header;
