'use client';

import React from 'react';
import { Check, X } from 'lucide-react';
import Select from 'react-select';
import styles from './FilterBar.module.css';

type Currency = 'aed' | 'usd';

interface FilterBarProps {
  hideSourceFilter?: boolean;
  sourceFilter: string;
  setSourceFilter: (filter: any) => void;
  sourceChannels: string[];
  customFilterContent?: React.ReactNode;
  dateDropdownsRef: React.RefObject<HTMLDivElement | null>;
  toggleDateDropdown: (kind: 'from' | 'to') => void;
  openDateDropdown: 'from' | 'to' | null;
  draftStartParts: { day: string; month: string; year: string };
  draftEndParts: { day: string; month: string; year: string };
  setDraftStartDate: (date: string) => void;
  setDraftEndDate: (date: string) => void;
  isDateRangeDirty: boolean;
  applyDateRangeDraft: () => void;
  startDate: string;
  endDate: string;
  today: string;
  onResetFilters: () => void;
  hideCurrency?: boolean;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  selectStyles: any;
  selectPortalTarget: HTMLElement | null;
  dayOptions: any[];
  monthOptions: any[];
  yearOptions: any[];
  mergeDate: (parts: { day: string; month: string; year: string }) => string;
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
  setDraftStartDate,
  setDraftEndDate,
  isDateRangeDirty,
  applyDateRangeDraft,
  startDate,
  endDate,
  today,
  onResetFilters,
  hideCurrency,
  currency,
  setCurrency,
  selectStyles,
  selectPortalTarget,
  dayOptions,
  monthOptions,
  yearOptions,
  mergeDate
}) => {
  return (
    <section className={styles.filterBar}>
      <div className={styles.filtersLeft}>
        {!hideSourceFilter && (
          <div className={styles.channels}>
            <button
              className={`${styles.channelChip} ${sourceFilter === 'all' ? styles.channelChipActive : ''}`}
              onClick={() => setSourceFilter('all')}
            >
              Все источники
            </button>
            {sourceChannels.map((ch) => (
              <button
                key={ch}
                className={`${styles.channelChip} ${sourceFilter === ch ? styles.channelChipActive : ''}`}
                onClick={() => setSourceFilter(ch)}
              >
                {ch}
              </button>
            ))}
          </div>
        )}

        <div className={styles.controlsRow} style={{ marginLeft: hideSourceFilter ? 'auto' : '0' }}>
          {customFilterContent}
          <div className={styles.dateGroups} ref={dateDropdownsRef}>
            <div className={styles.dateDropdown}>
              <div className={styles.dateDropdownHeader}>
                <button
                  type="button"
                  className={styles.dateDropdownTrigger}
                  onClick={() => toggleDateDropdown('from')}
                >
                  <span className={styles.dateDropdownLabel}>From</span>
                  <span className={styles.dateDropdownValue}>{`${draftStartParts.day}.${draftStartParts.month}.${draftStartParts.year}`}</span>
                  <span className={styles.dateDropdownArrow}>{openDateDropdown === 'from' ? '▴' : '▾'}</span>
                </button>
              </div>
              {openDateDropdown === 'from' ? (
                <div className={styles.dateDropdownMenu}>
                  <div className={styles.dateSelects}>
                    <Select
                      instanceId="start-day"
                      inputId="start-day"
                      isSearchable={false}
                      menuPortalTarget={selectPortalTarget}
                      menuPosition="fixed"
                      options={dayOptions}
                      styles={selectStyles}
                      value={dayOptions.find((d) => d.value === draftStartParts.day)}
                      onChange={(option: any) => {
                        if (!option) return;
                        setDraftStartDate(mergeDate({ ...draftStartParts, day: option.value }));
                      }}
                    />
                    <Select
                      instanceId="start-month"
                      inputId="start-month"
                      isSearchable={false}
                      menuPortalTarget={selectPortalTarget}
                      menuPosition="fixed"
                      options={monthOptions}
                      styles={selectStyles}
                      value={monthOptions.find((m) => m.value === draftStartParts.month)}
                      onChange={(option: any) => {
                        if (!option) return;
                        setDraftStartDate(mergeDate({ ...draftStartParts, month: option.value }));
                      }}
                    />
                    <Select
                      instanceId="start-year"
                      inputId="start-year"
                      isSearchable={false}
                      menuPortalTarget={selectPortalTarget}
                      menuPosition="fixed"
                      options={yearOptions}
                      styles={selectStyles}
                      value={yearOptions.find((y) => y.value === draftStartParts.year)}
                      onChange={(option: any) => {
                        if (!option) return;
                        setDraftStartDate(mergeDate({ ...draftStartParts, year: option.value }));
                      }}
                    />
                  </div>
                  <div className={styles.dateSelectHints}>
                    <span className={styles.dateSelectHint}>day</span>
                    <span className={styles.dateSelectHint}>month</span>
                    <span className={styles.dateSelectHint}>year</span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className={styles.dateDropdown}>
              <div className={styles.dateDropdownHeader}>
                <button
                  type="button"
                  className={styles.dateDropdownTrigger}
                  onClick={() => toggleDateDropdown('to')}
                >
                  <span className={styles.dateDropdownLabel}>To</span>
                  <span className={styles.dateDropdownValue}>{`${draftEndParts.day}.${draftEndParts.month}.${draftEndParts.year}`}</span>
                  <span className={styles.dateDropdownArrow}>{openDateDropdown === 'to' ? '▴' : '▾'}</span>
                </button>
                {isDateRangeDirty ? (
                  <button
                    type="button"
                    className={styles.dateApplyBtn}
                    onClick={applyDateRangeDraft}
                  >
                    <Check size={14} />
                  </button>
                ) : null}
                {(startDate !== '2024-01-01' || endDate !== today) && (
                  <button
                    type="button"
                    className={styles.dateApplyBtn}
                    style={{ background: '#f1f5f9', color: '#64748b', borderColor: '#e2e8f0', boxShadow: 'none' }}
                    onClick={onResetFilters}
                    title="Сбросить фильтр"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              {openDateDropdown === 'to' ? (
                <div className={styles.dateDropdownMenu}>
                  <div className={styles.dateSelects}>
                    <Select
                      instanceId="end-day"
                      inputId="end-day"
                      isSearchable={false}
                      menuPortalTarget={selectPortalTarget}
                      menuPosition="fixed"
                      options={dayOptions}
                      styles={selectStyles}
                      value={dayOptions.find((d) => d.value === draftEndParts.day)}
                      onChange={(option: any) => {
                        if (!option) return;
                        setDraftEndDate(mergeDate({ ...draftEndParts, day: option.value }));
                      }}
                    />
                    <Select
                      instanceId="end-month"
                      inputId="end-month"
                      isSearchable={false}
                      menuPortalTarget={selectPortalTarget}
                      menuPosition="fixed"
                      options={monthOptions}
                      styles={selectStyles}
                      value={monthOptions.find((m) => m.value === draftEndParts.month)}
                      onChange={(option: any) => {
                        if (!option) return;
                        setDraftEndDate(mergeDate({ ...draftEndParts, month: option.value }));
                      }}
                    />
                    <Select
                      instanceId="end-year"
                      inputId="end-year"
                      isSearchable={false}
                      menuPortalTarget={selectPortalTarget}
                      menuPosition="fixed"
                      options={yearOptions}
                      styles={selectStyles}
                      value={yearOptions.find((y) => y.value === draftEndParts.year)}
                      onChange={(option: any) => {
                        if (!option) return;
                        setDraftEndDate(mergeDate({ ...draftEndParts, year: option.value }));
                      }}
                    />
                  </div>
                  <div className={styles.dateSelectHints}>
                    <span className={styles.dateSelectHint}>day</span>
                    <span className={styles.dateSelectHint}>month</span>
                    <span className={styles.dateSelectHint}>year</span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {!hideCurrency && (
            <div className={styles.currencyBlock}>
              <div className={styles.currencySwitch}>
                <button
                  className={`${styles.currencyBtn} ${currency === 'aed' ? styles.currencyActive : ''}`}
                  onClick={() => setCurrency('aed')}
                >
                  AED
                </button>
                <button
                  className={`${styles.currencyBtn} ${currency === 'usd' ? styles.currencyActive : ''}`}
                  onClick={() => setCurrency('usd')}
                >
                  USD
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default FilterBar;
