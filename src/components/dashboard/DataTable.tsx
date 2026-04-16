'use client';

import React, { CSSProperties } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import styles from './DataTable.module.css';

interface DataTableProps {
  activeColumns: any[];
  requestSort: (key: any) => void;
  sortKey: string;
  sortDirection: string;
  startChannelResize: (e: any) => void;
  stickyHeaderVisible: boolean;
  stickyHeaderRef: React.RefObject<HTMLDivElement | null>;
  stickyHeaderLeft: number;
  stickyHeaderWidth: number;
  channelColWidth: number;
  tableMinWidth: string;
  tablePixelWidth: number;
  tableScrollLeft: number;
  tableWrapRef: React.RefObject<HTMLElement | null>;
  tableScrollRef: React.RefObject<HTMLDivElement | null>;
  tableRef: React.RefObject<HTMLTableElement | null>;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  showTableSkeletons: boolean;
  visibleRows: any[];
  expanded: Record<string, boolean>;
  expandedDetails: Record<string, boolean>;
  toggleExpanded: (ch: string) => void;
  toggleDetail: (key: string) => void;
  currency: string;
  selectedCells: Set<string>;
  handleCellMouseDown: (e: any, r: number, c: number) => void;
  handleCellMouseEnter: (r: number, c: number) => void;
  handleCellMouseUp: (e: any) => void;
  suppressRowToggleRef: React.RefObject<boolean>;
  renderValue: (val: any, type: any, currency?: any, decimals?: any) => React.ReactNode;
  formatPercentRatio: (val: any) => string;
  formatMoney: (val: any, currency: any) => string;
  OTHER_FALLBACK_LABEL: string;
  OTHER_FALLBACK_HINT: string;
  title?: string;
  icon?: React.ReactNode;
}

const DataTable: React.FC<DataTableProps> = ({
  activeColumns,
  requestSort,
  sortKey,
  sortDirection,
  startChannelResize,
  stickyHeaderVisible,
  stickyHeaderRef,
  stickyHeaderLeft,
  stickyHeaderWidth,
  channelColWidth,
  tableMinWidth,
  tablePixelWidth,
  tableScrollLeft,
  tableWrapRef,
  tableScrollRef,
  tableRef,
  onScroll,
  showTableSkeletons,
  visibleRows,
  expanded,
  expandedDetails,
  toggleExpanded,
  toggleDetail,
  currency,
  selectedCells,
  handleCellMouseDown,
  handleCellMouseEnter,
  handleCellMouseUp,
  suppressRowToggleRef,
  renderValue,
  formatPercentRatio,
  formatMoney,
  OTHER_FALLBACK_LABEL,
  OTHER_FALLBACK_HINT,
  title,
  icon
}) => {
  const renderTableHeader = (interactive: boolean) => (
    <tr>
      {activeColumns.map((col, i) => (
        <th
          key={col.key}
          onClick={interactive ? () => requestSort(col.key) : undefined}
          className={`${styles.sortableHead} ${sortKey === col.key ? styles.sortableHeadActive : ''} ${
            col.key === 'channel' ? styles.leftHead : ''
          }`}
        >
          <div className={col.key === 'channel' ? styles.leftHeadInner : undefined}>
            <span>{col.label}</span>
            {col.key === 'channel' ? null : (
              <span className={styles.sortMark}>
                {sortKey === col.key ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
              </span>
            )}
            {col.key === 'channel' ? (
              <button
                type="button"
                className={styles.colResizeHandle}
                aria-label="Resize channel column"
                onMouseDown={interactive ? startChannelResize : undefined}
                tabIndex={interactive ? 0 : -1}
              />
            ) : null}
          </div>
        </th>
      ))}
    </tr>
  );

  return (
    <section className={styles.card} ref={tableWrapRef}>
      {(title || icon) && (
        <div className={styles.cardHeader}>
          {icon && <span className={styles.cardIcon}>{icon}</span>}
          {title && <h2 className={styles.cardTitle}>{title}</h2>}
        </div>
      )}
      <div className={styles.cardBody}>
        {stickyHeaderVisible ? (
          <div
            ref={stickyHeaderRef}
            className={styles.floatingHeader}
            style={{ left: stickyHeaderLeft, width: stickyHeaderWidth } as CSSProperties}
          >
            <div className={styles.floatingHeaderViewport}>
              <table
                className={`${styles.table} ${styles.floatingHeaderTable}`}
                style={{
                  '--channel-col-width': `${channelColWidth}px`,
                  '--table-min-width': tableMinWidth,
                  width: tablePixelWidth ? `${tablePixelWidth}px` : undefined,
                  transform: `translateX(-${tableScrollLeft}px)`,
                } as CSSProperties}
              >
                <thead>{renderTableHeader(true)}</thead>
              </table>
            </div>
          </div>
        ) : null}
        <div
          className={styles.scroll}
          ref={tableScrollRef}
          onScroll={onScroll}
        >
          <table
            ref={tableRef}
            className={styles.table}
            aria-busy={showTableSkeletons}
            style={{ 
              '--channel-col-width': `${channelColWidth}px`,
              '--table-min-width': tableMinWidth
            } as CSSProperties}
          >
            <thead>
              {renderTableHeader(true)}
            </thead>
            <tbody>
              {visibleRows.map(({ type, row, key, label, detailDepth, detailKey, hasChildren }, rowIndex) => {
                const total = row.channel === 'TOTAL';
                const hasDetails = type === 'channel' ? !!hasChildren : false;
                const canExpandDetail = type === 'detail' && !!hasChildren && !!detailKey;
                const isDetailExpanded = detailKey ? !!expandedDetails[detailKey] : false;
                const isHierarchyActive =
                  (type === 'channel' && hasDetails && !!expanded[row.channel]) ||
                  (type === 'detail' && canExpandDetail && isDetailExpanded);
                const rowClass = total
                  ? styles.rowTotal
                  : type === 'channel'
                    ? styles.rowChannel
                    : styles.rowDetail;
                
                const rowValues = activeColumns.slice(1).map(col => {
                  const val = (row as any)[col.key];
                  if (col.key === 'budget') return renderValue(val, 'money', currency);
                  if (col.key === 'date') return renderValue(val, 'date', undefined);
                  if (col.key === 'leads') return renderValue(val, 'num', undefined);
                  if (col.key === 'cpl') return renderValue(val, 'money', currency);
                  if (col.key === 'no_answer_spam') return renderValue(val, 'num', undefined);
                  if (col.key === 'rate_answer') {
                    const ansVal = Number(val) || 0;
                    return <span className={ansVal < 0.2 && ansVal > 0 ? styles.roiNegative : ''}>{renderValue(val, 'pct', undefined)}</span>;
                  }
                  if (col.key === 'qualified_leads') return renderValue(val, 'num', undefined);
                  if (col.key === 'cost_per_qualified_leads') return renderValue(val, 'money', currency);
                  if (col.key === 'cr_ql') return renderValue(val, 'pct', undefined);
                  if (col.key === 'ql_actual') return renderValue(val, 'num', undefined);
                  if (col.key === 'cpql_actual') return renderValue(val, 'money', currency);
                  if (col.key === 'meetings') return renderValue(val, 'num', undefined);
                  if (col.key === 'cp_meetings') return renderValue(val, 'money', currency);
                  if (col.key === 'deals') return renderValue(val, 'num', undefined);
                  if (col.key === 'cost_per_deal') return renderValue(val, 'money', currency);
                  if (col.key === 'revenue') return renderValue(val, 'money', currency);
                  if (col.key === 'roi') {
                      const roiVal = Number(val) || 0;
                      const colorClass = roiVal >= 1 ? styles.roiPositive : styles.roiNegative;
                      const content = formatPercentRatio(val);
                      return <span className={roiVal === 0 ? styles.dimmed : colorClass}>{content}</span>;
                  }
                  if (col.key === 'company_revenue') {
                      if (val === null || val === undefined || val === 0) return <span className={styles.dimmed}>{val === 0 ? formatMoney(0, currency) : 'uncertain'}</span>;
                      return formatMoney(val, currency);
                  }
                  // Website Cols
                  if (col.key === 'impressions') return renderValue(val, 'num', undefined);
                  if (col.key === 'clicks') return renderValue(val, 'num', undefined);
                  if (col.key === 'ctr') return renderValue((row.clicks || 0) / (row.impressions || 1), 'pct', undefined, 2);
                  if (col.key === 'ad_cost') return renderValue(val, 'money', currency);
                  if (col.key === 'sessions') return renderValue(val, 'num', undefined);
                  if (col.key === 'bounce_rate') return renderValue(val, 'pct', undefined);
                  if (col.key === 'avg_duration') return renderValue(val, 'time', undefined);
                  if (col.key === 'cr_lead') return renderValue(((row.leads_crm || 0) + (row.leads_wa || 0)) / (row.sessions || 1), 'pct', undefined, 2);
                  if (col.key === 'leads_crm') return renderValue(val, 'num', undefined);
                  if (col.key === 'leads_wa') return renderValue(val, 'num', undefined);
                  if (col.key === 'cr_ql_web') return renderValue((row.qualified_leads || 0) / (row.leads_crm || 1), 'pct', undefined, 2);
                  if (col.key === 'cpql_web') return renderValue((row.ad_cost || 0) / (row.qualified_leads || 1), 'money', currency);
                  
                  return val;
                });

                return (
                  <tr
                    key={key}
                    className={`${rowClass} ${isHierarchyActive ? styles.rowHierarchyActive : ''}`}
                    onClick={
                      suppressRowToggleRef.current
                        ? undefined
                        :
                      type === 'channel' && hasDetails
                        ? () => toggleExpanded(row.channel)
                        : canExpandDetail
                          ? () => toggleDetail(detailKey!)
                          : undefined
                    }
                  >
                    <td>
                      {(() => {
                        const treeStyle =
                          type === 'detail' && detailDepth
                            ? ({
                                paddingLeft: `${detailDepth * 22}px`,
                                '--tree-depth': detailDepth,
                              } as CSSProperties)
                            : undefined;

                        return (
                          <div
                            className={`${styles.channelCell} ${
                              type === 'detail' && detailDepth ? styles.channelCellDetail : ''
                            } ${type === 'detail' && detailDepth && detailDepth > 1 ? styles.channelCellDeep : ''}`}
                            style={treeStyle}
                          >
                            {type === 'channel' ? (
                              <span className={`${styles.arrow} ${hasDetails ? styles.arrowClickable : ''}`}>
                                {hasDetails ? (expanded[row.channel] ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
                              </span>
                            ) : canExpandDetail ? (
                              <span className={`${styles.arrow} ${styles.arrowClickable}`}>
                                {isDetailExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </span>
                            ) : (
                              <span className={styles.arrow} />
                            )}
                            <div
                              className={styles.channelLabel}
                              title={!showTableSkeletons && type === 'detail' && label === OTHER_FALLBACK_LABEL ? OTHER_FALLBACK_HINT : undefined}
                            >
                              {showTableSkeletons ? <span className={styles.skeletonText} /> : type === 'channel' ? row.channel : label}
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    {rowValues.map((value, colOffset) => {
                      const colIndex = colOffset + 1;
                      return (
                        <td
                          key={`${key}-col-${colIndex}`}
                          className={selectedCells.has(`${rowIndex}:${colIndex}`) ? styles.cellSelected : ''}
                          onMouseDown={(event) => handleCellMouseDown(event, rowIndex, colIndex)}
                          onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
                          onMouseUp={handleCellMouseUp}
                        >
                          {showTableSkeletons ? <span className={styles.skeletonValue} /> : value}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default DataTable;
