'use client';

import React, { useState, useEffect } from 'react';
import { 
  ChevronDown,
  Check
} from 'lucide-react';
import Select from 'react-select';
import styles from './FilterBar.module.css';

interface FilterBarProps {
  hideSourceFilter?: boolean;
  sourceFilter: string;
  setSourceFilter: (val: string) => void;
  sourceChannels: { label: string; value: string }[];
  customFilterContent?: React.ReactNode;
  dateDropdownsRef: React.RefObject<HTMLDivElement | null>;
  toggleDateDropdown: (kind: 'from' | 'to') => void;
  openDateDropdown: 'from' | 'to' | null;
  draftStartParts: { day: string; month: string; year: string };
  draftEndParts: { day: string; month: string; year: string };
  setDraftStartDate: (val: string) => void;
  setDraftEndDate: (val: string) => void;
  isDateRangeDirty: boolean;
  applyDateRangeDraft: () => void;
  setExactDateRange: (start: string, end: string) => void;
  startDate: string;
  endDate: string;
  today: string;
  onResetFilters?: () => void;
  hideCurrency?: boolean;
  currency: 'usd' | 'aed';
  setCurrency: (val: 'usd' | 'aed') => void;
  selectStyles: any;
  selectPortalTarget: HTMLElement | null;
  dayOptions: { label: string; value: string }[];
  monthOptions: { label: string; value: string }[];
  yearOptions: { label: string; value: string }[];
  mergeDate: (parts: { day: string; month: string; year: string }) => string;
  layoutVariant?: 'marketing' | 'red';
}

const FilterBar: React.FC<FilterBarProps> = ({
  hideSourceFilter,
  sourceFilter,
  setSourceFilter,
  sourceChannels,
  customFilterContent,
  dateDropdownsRef,
  toggleDateDropdown,
  openDateDropdown,
  draftStartParts,
  draftEndParts,
  isDateRangeDirty,
  applyDateRangeDraft,
  setExactDateRange,
  startDate,
  endDate,
  today,
  hideCurrency,
  currency,
  setCurrency,
  selectStyles,
  selectPortalTarget,
  dayOptions,
  monthOptions,
  yearOptions,
  mergeDate,
  layoutVariant = 'marketing'
}) => {
  const [datePreset, setDatePreset] = useState('All time');

  const presets = [
    { label: 'All time', start: '2024-01-01', end: today },
    { label: 'Today', start: today, end: today },
    { label: 'Last 7 days', start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), end: today },
    { label: 'Last 30 days', start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), end: today },
    { label: 'Custom', start: startDate, end: endDate }
  ];

  useEffect(() => {
    const matching = presets.find(p => p.start === startDate && p.end === endDate);
    if (matching && matching.label !== 'Custom') {
      setDatePreset(matching.label);
    } else {
      setDatePreset('Custom');
    }
  }, [startDate, endDate]);

  const handlePresetClick = (preset: any) => {
    setDatePreset(preset.label);
    if (preset.label !== 'Custom') {
      setExactDateRange(preset.start, preset.end);
    }
  };

  const renderDateControls = () => (
    <div className={styles.dateGroups} ref={dateDropdownsRef}>
      <div className={styles.dateDropdown}>
        <button type="button" className={styles.dateDropdownTrigger} onClick={() => toggleDateDropdown('from')}>
          <span className={styles.dateDropdownLabel}>From</span>
          <span className={styles.dateDropdownValue}>{`${draftStartParts.day}.${draftStartParts.month}.${draftStartParts.year}`}</span>
          <span className={styles.dateDropdownArrow} style={{ transform: openDateDropdown === 'from' ? 'rotate(180deg)' : 'none' }}>
            <ChevronDown size={14} />
          </span>
        </button>
        {openDateDropdown === 'from' && (
          <div className={styles.dateDropdownMenu}>
            <div className={styles.dateSelects}>
              <Select instanceId="start-day" inputId="start-day" styles={selectStyles} menuPortalTarget={selectPortalTarget} options={dayOptions} value={dayOptions.find(o => o.value === draftStartParts.day)} onChange={(opt: any) => setDraftStartDate(mergeDate({ ...draftStartParts, day: opt.value }))} isSearchable={false} />
              <Select instanceId="start-month" inputId="start-month" styles={selectStyles} menuPortalTarget={selectPortalTarget} options={monthOptions} value={monthOptions.find(o => o.value === draftStartParts.month)} onChange={(opt: any) => setDraftStartDate(mergeDate({ ...draftStartParts, month: opt.value }))} isSearchable={false} />
              <Select instanceId="start-year" inputId="start-year" styles={selectStyles} menuPortalTarget={selectPortalTarget} options={yearOptions} value={yearOptions.find(o => o.value === draftStartParts.year)} onChange={(opt: any) => setDraftStartDate(mergeDate({ ...draftStartParts, year: opt.value }))} isSearchable={false} />
            </div>
            <div className={styles.dateSelectHints}>
              <div className={styles.dateSelectHint}>Day</div>
              <div className={styles.dateSelectHint}>Month</div>
              <div className={styles.dateSelectHint}>Year</div>
            </div>
          </div>
        )}
      </div>
      <div className={styles.dateDropdown}>
        <button type="button" className={styles.dateDropdownTrigger} onClick={() => toggleDateDropdown('to')}>
          <span className={styles.dateDropdownLabel}>To</span>
          <span className={styles.dateDropdownValue}>{`${draftEndParts.day}.${draftEndParts.month}.${draftEndParts.year}`}</span>
          <span className={styles.dateDropdownArrow} style={{ transform: openDateDropdown === 'to' ? 'rotate(180deg)' : 'none' }}>
            <ChevronDown size={14} />
          </span>
        </button>
        {openDateDropdown === 'to' && (
          <div className={styles.dateDropdownMenu}>
            <div className={styles.dateSelects}>
              <Select instanceId="end-day" inputId="end-day" styles={selectStyles} menuPortalTarget={selectPortalTarget} options={dayOptions} value={dayOptions.find(o => o.value === draftEndParts.day)} onChange={(opt: any) => setDraftEndDate(mergeDate({ ...draftEndParts, day: opt.value }))} isSearchable={false} />
              <Select instanceId="end-month" inputId="end-month" styles={selectStyles} menuPortalTarget={selectPortalTarget} options={monthOptions} value={monthOptions.find(o => o.value === draftEndParts.month)} onChange={(opt: any) => setDraftEndDate(mergeDate({ ...draftEndParts, month: opt.value }))} isSearchable={false} />
              <Select instanceId="end-year" inputId="end-year" styles={selectStyles} menuPortalTarget={selectPortalTarget} options={yearOptions} value={yearOptions.find(o => o.value === draftEndParts.year)} onChange={(opt: any) => setDraftEndDate(mergeDate({ ...draftEndParts, year: opt.value }))} isSearchable={false} />
            </div>
            <div className={styles.dateSelectHints}>
              <div className={styles.dateSelectHint}>Day</div>
              <div className={styles.dateSelectHint}>Month</div>
              <div className={styles.dateSelectHint}>Year</div>
            </div>
          </div>
        )}
      </div>
      {isDateRangeDirty && <button className={styles.dateApplyBtn} onClick={applyDateRangeDraft}><Check size={18} /></button>}
    </div>
  );

  const renderCurrency = () => !hideCurrency && (
    <div className={styles.currencySwitch}>
      <button className={`${styles.currencyBtn} ${currency === 'aed' ? styles.currencyActive : ''}`} onClick={() => setCurrency('aed')}>AED</button>
      <button className={`${styles.currencyBtn} ${currency === 'usd' ? styles.currencyActive : ''}`} onClick={() => setCurrency('usd')}>USD</button>
    </div>
  );

  if (layoutVariant === 'red') {
    return (
      <div className={`${styles.filterBar} ${styles.redVariant}`}>
        <div className={styles.presetsContainer}>
          {presets.map(p => (
            <button key={p.label} className={`${styles.presetBtn} ${datePreset === p.label ? styles.presetActive : ''}`} onClick={() => handlePresetClick(p)}>{p.label}</button>
          ))}
        </div>
        
        {customFilterContent && <div className={styles.customContent}>{customFilterContent}</div>}

        {datePreset === 'Custom' && renderDateControls()}
        
        <div className={styles.currencyBlockRight}>
          {renderCurrency()}
        </div>
      </div>
    );
  }

  // Default / Marketing (2 rows)
  return (
    <div className={`${styles.filterBar} ${styles.marketingVariant}`}>
      <div className={styles.topRail}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {!hideSourceFilter && (
            <div className={styles.channels}>
              {sourceChannels.map((ch) => (
                <button key={ch.value} className={`${styles.channelChip} ${sourceFilter === ch.value ? styles.channelChipActive : ''}`} onClick={() => setSourceFilter(ch.value)}>{ch.label}</button>
              ))}
            </div>
          )}
          {customFilterContent && <div className={styles.customContent}>{customFilterContent}</div>}
        </div>
        {renderCurrency()}
      </div>
      <div className={styles.dateRow}>
        <div className={styles.presetsContainer}>
          {presets.map(p => (
            <button key={p.label} className={`${styles.presetBtn} ${datePreset === p.label ? styles.presetActive : ''}`} onClick={() => handlePresetClick(p)}>{p.label}</button>
          ))}
        </div>
        {datePreset === 'Custom' && renderDateControls()}
      </div>
    </div>
  );
};

export default FilterBar;
