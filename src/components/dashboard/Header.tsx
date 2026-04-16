'use client';

import React from 'react';
import { Search, Moon, Sun } from 'lucide-react';
import styles from './Header.module.css';

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  themeMode: 'night' | 'light';
  setThemeMode: (mode: 'night' | 'light' | ((prev: 'night' | 'light') => 'night' | 'light')) => void;
}

const Header: React.FC<HeaderProps> = ({
  searchQuery,
  setSearchQuery,
  themeMode,
  setThemeMode
}) => {
  return (
    <div className={styles.topRail}>
      <div className={styles.headerSearch}>
        <label className={styles.searchField}>
          <Search size={14} />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className={styles.searchInput}
            placeholder="Search campaigns, channels, creatives..."
            aria-label="Search dashboard rows"
          />
        </label>
      </div>
      <div className={styles.headerSwitchWrap}>
        <span className={styles.themeSwitchLabel}>
          {themeMode === 'night' ? 'Night' : 'Light'}
        </span>
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
  );
};

export default Header;
