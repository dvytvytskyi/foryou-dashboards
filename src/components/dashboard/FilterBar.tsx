'use client';

import React, { useState, useEffect } from 'react';
import { 
  ChevronDown,
  Check,
  Download
} from 'lucide-react';
import Select from 'react-select';
import { DatePickerWithRange } from '../ui/DatePickerWithRange';
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
  datePresetMode?: 'default' | 'plan-fact-months' | 'expenses-months';
  maxEndDate?: string;
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
  setDraftStartDate,
  setDraftEndDate,
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
  layoutVariant = 'marketing',
  datePresetMode = 'default',
  maxEndDate,
}) => {
  const [datePreset, setDatePreset] = useState('All time');
  const [openDatePickerTrigger, setOpenDatePickerTrigger] = useState(0);

  const monthRange = (year: string, month: number) => {
    const mm = String(month).padStart(2, '0');
    const lastDay = new Date(Number(year), month, 0).getDate();
    const dd = String(lastDay).padStart(2, '0');
    return {
      start: `${year}-${mm}-01`,
      end: `${year}-${mm}-${dd}`,
    };
  };

  const presets = datePresetMode === 'plan-fact-months'
    ? [
        { label: 'May', ...monthRange('2026', 5) },
        { label: 'June', ...monthRange('2026', 6) },
        { label: 'July', ...monthRange('2026', 7) },
        { label: 'August', ...monthRange('2026', 8) },
        { label: 'September', ...monthRange('2026', 9) },
        { label: 'Custom', start: startDate, end: endDate },
      ]
    : datePresetMode === 'expenses-months'
    ? [
        { label: '2026', start: '2026-01-01', end: '2026-12-31' },
        { label: 'January', ...monthRange('2026', 1) },
        { label: 'February', ...monthRange('2026', 2) },
        { label: 'March', ...monthRange('2026', 3) },
        { label: 'April', ...monthRange('2026', 4) },
        { label: 'May', ...monthRange('2026', 5) },
        { label: 'Custom', start: startDate, end: endDate },
      ]
    : [
        { label: 'All time', start: '2024-01-01', end: today },
        { label: '2026', start: '2026-01-01', end: today },
        { label: 'Today', start: today, end: today },
        { label: 'Last 7 days', start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), end: today },
        { label: 'Last 30 days', start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), end: today },
        { label: 'Custom', start: startDate, end: endDate },
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
    } else {
      setOpenDatePickerTrigger(prev => prev + 1);
    }
  };

  const renderDateControls = () => (
    <DatePickerWithRange 
      startDate={startDate} 
      endDate={endDate} 
      onApply={setExactDateRange} 
      openTrigger={openDatePickerTrigger}
    />
  );

  const renderCurrency = () => !hideCurrency && (
    <div className={styles.currencySwitch}>
      <button className={`${styles.currencyBtn} ${currency === 'aed' ? styles.currencyActive : ''}`} onClick={() => setCurrency('aed')}>AED</button>
      <button className={`${styles.currencyBtn} ${currency === 'usd' ? styles.currencyActive : ''}`} onClick={() => setCurrency('usd')}>USD</button>
    </div>
  );

  const renderExportBtn = () => (
    <button className={styles.exportCsvBtn}>
      <Download size={14} />
      Export CSV
    </button>
  );

  if (layoutVariant === 'red') {
    return (
      <div className={`${styles.filterBar} ${styles.redVariant}`}>
        {customFilterContent && <div className={styles.customContent}>{customFilterContent}</div>}

        <div className={styles.presetsContainer}>
          {presets.map(p => (
            <button key={p.label} className={`${styles.presetBtn} ${datePreset === p.label ? styles.presetActive : ''}`} onClick={() => handlePresetClick(p)}>{p.label}</button>
          ))}
        </div>
        
        {datePreset === 'Custom' && renderDateControls()}
        
        <div className={styles.currencyBlockRight}>
          <div style={{ display: 'flex', gap: '12px' }}>
            {renderExportBtn()}
            {renderCurrency()}
          </div>
        </div>
      </div>
    );
  }

  // Default / Marketing (2 rows)
  return (
    <div className={`${styles.filterBar} ${styles.marketingVariant}`}>
      <div className={styles.topRail}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {customFilterContent && <div className={styles.customContent}>{customFilterContent}</div>}
          {!hideSourceFilter && (
            <div className={styles.channels}>
              {sourceChannels.map((ch) => (
                <button key={ch.value} className={`${styles.channelChip} ${sourceFilter === ch.value ? styles.channelChipActive : ''}`} onClick={() => setSourceFilter(sourceFilter === ch.value ? 'all' : ch.value)}>{ch.label}</button>
              ))}
            </div>
          )}
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
        {renderExportBtn()}
      </div>
    </div>
  );
};

export default FilterBar;
