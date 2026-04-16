'use client';

import { CSSProperties, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Search,
  Check,
  Sun,
  Moon,
  ChevronRight,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
  Compass,
  BarChart3,
  Users,
  Trophy,
  Star,
  Handshake,
  Wallet,
  FileText,
  Megaphone,
  Building2,
  Tags,
  Globe,
  Zap,
  Facebook,
  Target,
  Facebook as FacebookIcon,
  X,
  Calendar,
  User,
} from 'lucide-react';
import Select from 'react-select';
import {
  FACEBOOK_COLUMNS_MAIN,
  MARKETING_COLUMNS,
  RED_COLUMNS_GEO,
  RED_COLUMNS_MAIN,
  WEBSITE_COLUMNS,
} from '@/components/dashboard/columns';
import { NAVIGATION_SECTIONS } from '@/lib/navigation';
import {
  formatDurationSeconds,
  formatMoney,
  formatNumber,
  formatPercentRatio,
} from '@/lib/formatters';
import styles from './DashboardPage.module.css';

export {
  FACEBOOK_COLUMNS_MAIN,
  MARKETING_COLUMNS,
  RED_COLUMNS_GEO,
  RED_COLUMNS_MAIN,
  WEBSITE_COLUMNS,
} from '@/components/dashboard/columns';

type Currency = 'aed' | 'usd';
type ThemeMode = 'night' | 'light';
type SortDirection = 'asc' | 'desc';
type SortKey =
  | 'channel'
  | 'budget'
  | 'date'
  | 'leads'
  | 'cpl'
  | 'no_answer_spam'
  | 'rate_answer'
  | 'qualified_leads'
  | 'cost_per_qualified_leads'
  | 'cr_ql'
  | 'ql_actual'
  | 'cpql_actual'
  | 'meetings'
  | 'cp_meetings'
  | 'deals'
  | 'cost_per_deal'
  | 'revenue'
  | 'roi'
  | 'company_revenue';

type Row = {
  channel: string;
  level_1: string | null;
  level_2: string | null;
  level_3: string | null;
  budget: number;
  date: string;
  leads: number;
  cpl: number;
  no_answer_spam: number;
  rate_answer: number;
  qualified_leads: number;
  cost_per_qualified_leads: number;
  cr_ql: number;
  ql_actual: number;
  cpql_actual: number;
  meetings: number;
  cp_meetings: number;
  deals: number;
  cost_per_deal: number;
  revenue: number;
  roi: number;
  company_revenue: number;
  sort_order: number;
  // New Website Metrics
  impressions?: number;
  clicks?: number;
  ad_cost?: number;
  sessions?: number;
  bounce_rate?: number;
  avg_duration?: number;
  leads_crm?: number;
  leads_wa?: number;
};

const CHANNELS = ['RED', 'Facebook', 'Klykov', 'Partners leads', 'OKK', 'Own leads', 'Property Finder'] as const;

type ChannelName = (typeof CHANNELS)[number];
type SourceFilter = 'all' | Exclude<ChannelName, 'TOTAL'>;
const SOURCE_CHANNELS = CHANNELS.filter((channel) => channel !== 'TOTAL') as Exclude<ChannelName, 'TOTAL'>[];

const RED_DRILLDOWN_GROUPS: Array<{ id: 'level_1' | 'level_2' | 'level_3'; label: string }> = [
  { id: 'level_1', label: 'название РК' },
  { id: 'level_2', label: 'название campaign' },
  { id: 'level_3', label: 'название креатива' },
];

const SPECIAL_DRILLDOWN_CHANNELS = new Set<ChannelName>(['Facebook / Target Point'] as any[]);
const OTHER_FALLBACK_LABEL = 'Без названия сделки';
const OTHER_FALLBACK_HINT = 'Записи без заполненного названия сделки (level_1)';

const EMPTY_ROW = (channel: string, sort_order: number): Row => ({
  channel,
  level_1: null,
  level_2: null,
  level_3: null,
  budget: 0,
  date: '-',
  leads: 0,
  cpl: 0,
  no_answer_spam: 0,
  rate_answer: 0,
  qualified_leads: 0,
  cost_per_qualified_leads: 0,
  cr_ql: 0,
  ql_actual: 0,
  cpql_actual: 0,
  meetings: 0,
  cp_meetings: 0,
  deals: 0,
  cost_per_deal: 0,
  revenue: 0,
  roi: 0,
  company_revenue: 0,
  sort_order,
  impressions: 0,
  clicks: 0,
  ad_cost: 0,
  sessions: 0,
  bounce_rate: 0,
  avg_duration: 0,
  leads_crm: 0,
  leads_wa: 0,
});

function addMetrics(target: Row, cur: Row) {
  target.budget += Number(cur.budget) || 0;
  target.leads += Number(cur.leads) || 0;
  target.no_answer_spam += Number(cur.no_answer_spam) || 0;
  target.qualified_leads += Number(cur.qualified_leads) || 0;
  target.ql_actual += Number(cur.ql_actual) || 0;
  target.meetings += Number(cur.meetings) || 0;
  target.deals += Number(cur.deals) || 0;
  target.revenue += Number(cur.revenue) || 0;
  target.company_revenue += Number(cur.company_revenue) || 0;
  target.impressions = (target.impressions || 0) + (Number(cur.impressions) || 0);
  target.clicks = (target.clicks || 0) + (Number(cur.clicks) || 0);
  target.ad_cost = (target.ad_cost || 0) + (Number(cur.ad_cost) || 0);
  target.sessions = (target.sessions || 0) + (Number(cur.sessions) || 0);
  target.leads_crm = (target.leads_crm || 0) + (Number(cur.leads_crm) || 0);
  target.leads_wa = (target.leads_wa || 0) + (Number(cur.leads_wa) || 0);
  
  // Weights for averages (simplified)
  if (cur.sessions) {
    const totalSessions = (target.sessions || 0);
    const weight = cur.sessions / (totalSessions || 1);
    target.bounce_rate = ((target.bounce_rate || 0) * (1 - weight)) + ((cur.bounce_rate || 0) * weight);
    target.avg_duration = ((target.avg_duration || 0) * (1 - weight)) + ((cur.avg_duration || 0) * weight);
  }
}

function recalcDerived(row: Row) {
  row.cpl = row.leads ? row.budget / row.leads : 0;
  row.rate_answer = row.leads ? (row.leads - row.no_answer_spam) / row.leads : 0;
  row.cost_per_qualified_leads = row.qualified_leads ? row.budget / row.qualified_leads : 0;
  row.cr_ql = row.leads ? row.qualified_leads / row.leads : 0;
  row.cpql_actual = row.ql_actual ? row.budget / row.ql_actual : 0;
  row.cp_meetings = row.meetings ? row.budget / row.meetings : 0;
  row.cost_per_deal = row.deals ? row.budget / row.deals : 0;
  row.roi = row.budget ? row.revenue / row.budget : 0;
  
  // Custom for Website
  if (row.impressions || row.sessions || row.clicks) {
     // These are already aggregated or weighted in addMetrics
  }
}

function aggregateRows(items: Row[], channel: string, sortOrder: number): Row {
  const total = EMPTY_ROW(channel, sortOrder);
  if (items.length === 1) {
    total.date = items[0].date;
  } else if (items.length > 1) {
    const firstDate = items[0].date;
    const same = items.every(i => i.date === firstDate);
    if (same) total.date = firstDate;
  }
  for (const item of items) addMetrics(total, item);
  recalcDerived(total);
  return total;
}

function levelLabel(value: string | null, fallback = OTHER_FALLBACK_LABEL) {
  const normalized = (value || '').trim();
  return normalized || fallback;
}

function pickRedRowsByLevel(groupId: 'level_1' | 'level_2' | 'level_3', rows: Row[]) {
  const hasL1 = (r: Row) => !!r.level_1?.trim();
  const hasL2 = (r: Row) => !!r.level_2?.trim();
  const hasL3 = (r: Row) => !!r.level_3?.trim();

  if (groupId === 'level_1') {
    const preferred = rows.filter((r) => hasL1(r) && !hasL2(r) && !hasL3(r));
    if (preferred.length > 0) return preferred;
    return rows.filter((r) => hasL1(r));
  }

  if (groupId === 'level_2') {
    const preferred = rows.filter((r) => hasL2(r) && !hasL3(r));
    if (preferred.length > 0) return preferred;
    return rows.filter((r) => hasL2(r));
  }

  const preferred = rows.filter((r) => hasL3(r));
  if (preferred.length > 0) return preferred;
  return rows;
}

function renderValue(val: any, type: 'money' | 'num' | 'pct' | 'date' | 'time', currency?: Currency, decimals?: number) {
  const isZero = val === 0 || val === '0' || val === '0.0%' || val === '-' || val === 'AED 0' || val === '$ 0';
  const display = type === 'money' ? formatMoney(val, currency) : 
                  type === 'num' ? formatNumber(val) : 
                  type === 'pct' ? formatPercentRatio(val, decimals) : 
                  type === 'time' ? formatDurationSeconds(val) : val;
  
  if (isZero || !val || val === 0) {
    return <span className={styles.dimmed}>{display}</span>;
  }
  return display;
}

function normalizeChannel(raw: string): string {
  if (raw === 'Facebook') return 'Facebook / Target Point';
  return raw;
}

type SelectOption = { value: string; label: string };

const DAY_OPTIONS: SelectOption[] = Array.from({ length: 31 }, (_, i) => {
  const day = String(i + 1).padStart(2, '0');
  return { value: day, label: day };
});

const MONTH_OPTIONS: SelectOption[] = Array.from({ length: 12 }, (_, i) => {
  const month = String(i + 1).padStart(2, '0');
  return { value: month, label: month };
});

const YEAR_OPTIONS: SelectOption[] = ['2026', '2025', '2024', '2023', '2022'].map((year) => ({
  value: year,
  label: year,
}));

function splitDate(value: string) {
  const [year = '2024', month = '01', day = '01'] = value.split('-');
  return { day, month, year };
}

function mergeDate(parts: { day: string; month: string; year: string }) {
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export default function DashboardPage({
  extraContent = null,
  title = 'General Marketing',
  initialSourceFilter = 'all',
  hideSourceFilter = false,
  hiddenColumns = [],
  firstColumnLabel = 'Channel',
  children,
  initialRows = null,
  isNested = false,
  externalThemeMode = null,
  onThemeChange = null,
  maxDrilldownLevel = 3,
  defaultChannelWidth = 330,
  tableMinWidth = '3000px',
  initialExpanded = [],
  apiUrl = '/api/marketing',
  hideTotal = false,
  hideTable = false,
  hideFilters = false,
  hideCurrency = false,
  customFilterContent = null,
  customColumns,
  onDateChange,
}: { 
  extraContent?: React.ReactNode, 
  initialSourceFilter?: SourceFilter,
  hideSourceFilter?: boolean,
  hiddenColumns?: string[],
  firstColumnLabel?: string,
  isNested?: boolean,
  title?: string,
  children?: React.ReactNode,
  initialRows?: Row[] | null,
  externalThemeMode?: 'light' | 'night' | null,
  onThemeChange?: (mode: 'light' | 'night') => void,
  maxDrilldownLevel?: number,
  defaultChannelWidth?: number,
  tableMinWidth?: string,
  initialExpanded?: string[],
  apiUrl?: string,
  hideTotal?: boolean,
  hideTable?: boolean,
  hideFilters?: boolean,
  hideCurrency?: boolean,
  customFilterContent?: React.ReactNode,
  customColumns?: Array<{ key: string; label: string }>;
  onDateChange?: (start: string, end: string) => void;
}) {
  const activeColumns = useMemo(() => {
    const base = customColumns || MARKETING_COLUMNS;
    return base.filter(col => !hiddenColumns.includes(col.key)).map(col => 
      col.key === 'channel' ? { ...col, label: firstColumnLabel } : col
    );
  }, [customColumns, hiddenColumns, firstColumnLabel]);

  const DEFAULT_CHANNEL_WIDTH = 330;
  const MIN_CHANNEL_WIDTH = 120;
  const MAX_CHANNEL_WIDTH = 620;

  const today = new Date().toISOString().slice(0, 10);

  const [currency, setCurrency] = useState<Currency>(() => {
    if (isNested) return 'aed';
    try { return (localStorage.getItem('dashboard-currency') as Currency) || 'aed'; } catch { return 'aed'; }
  });
  const [startDate, setStartDate] = useState(() => {
    if (isNested) return '2024-01-01';
    try { return localStorage.getItem('dashboard-startDate') || '2024-01-01'; } catch { return '2024-01-01'; }
  });
  const [endDate, setEndDate] = useState(() => {
    if (isNested) return today;
    try { return localStorage.getItem('dashboard-endDate') || today; } catch { return today; }
  });
  const [draftStartDate, setDraftStartDate] = useState(() => {
    if (isNested) return '2024-01-01';
    try { return localStorage.getItem('dashboard-startDate') || '2024-01-01'; } catch { return '2024-01-01'; }
  });
  const [draftEndDate, setDraftEndDate] = useState(() => {
    if (isNested) return today;
    try { return localStorage.getItem('dashboard-endDate') || today; } catch { return today; }
  });
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>(() => {
    if (isNested) return initialSourceFilter;
    try { return (localStorage.getItem('dashboard-sourceFilter') as SourceFilter) || initialSourceFilter; } catch { return initialSourceFilter; }
  });
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const obj: Record<string, boolean> = {};
    if (initialExpanded && Array.isArray(initialExpanded)) {
      initialExpanded.forEach((ch) => { obj[ch] = true; });
    }
    return obj;
  });
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(() => (apiUrl && !initialRows));
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('channel');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [internalThemeMode, setInternalThemeMode] = useState<ThemeMode>('light');
  const themeMode = externalThemeMode || internalThemeMode;
  
  const setThemeMode = useCallback((updater: ThemeMode | ((prev: ThemeMode) => ThemeMode)) => {
    const next = typeof updater === 'function' ? updater(themeMode) : updater;
    setInternalThemeMode(next);
    onThemeChange?.(next);
  }, [themeMode, onThemeChange]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarCompact, setSidebarCompact] = useState(false);
  const [openDateDropdown, setOpenDateDropdown] = useState<'from' | 'to' | null>(null);
  const [channelColWidth, setChannelColWidth] = useState(defaultChannelWidth);
  const [isResizingChannel, setIsResizingChannel] = useState(false);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [selectionAnchor, setSelectionAnchor] = useState<{ rowIndex: number; colIndex: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [tableScrollLeft, setTableScrollLeft] = useState(0);
  const [stickyHeaderVisible, setStickyHeaderVisible] = useState(false);
  const [stickyHeaderLeft, setStickyHeaderLeft] = useState(0);
  const [stickyHeaderWidth, setStickyHeaderWidth] = useState(0);
  const [tablePixelWidth, setTablePixelWidth] = useState(0);
  const [user, setUser] = useState<{ role: string; partnerId?: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(isNested);

  useEffect(() => {
    if (isNested) return;
    setAuthChecked(false);
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (!data.success) {
            window.location.replace('/login');
            return;
        }

        setUser(data.user);
        setAuthChecked(true);

        // Route protection: if partner tries to access root marketing or other pages
        if (data.user.role === 'partner') {
            const pId = data.user.partnerId || 'klykov';
            const path = window.location.pathname;
            if (!path.includes(`/partners/${pId}`)) {
                window.location.href = `/partners/${pId}`;
            }
        }
      })
      .catch(err => {
        console.error('Session fetch failed', err);
        window.location.replace('/login');
      });
  }, [isNested]);

  const filteredSidebarSections = useMemo(() => {
    if (!user) return NAVIGATION_SECTIONS;
    
    // If partner, hide Marketing and force Partners to go to their specific page
    if (user.role === 'partner') {
        const pId = user.partnerId || 'klykov';
        return NAVIGATION_SECTIONS
            .filter(section => section.title !== 'Маркетинг')
            .map(section => {
                if (section.title === 'Партнеры') {
                    return {
                        ...section,
                        items: section.items.map(item => ({
                            ...item,
                            href: `/partners/${pId}`
                        }))
                    };
                }
                return section;
            });
    }
    
    return NAVIGATION_SECTIONS;
  }, [user]);

  const suppressRowToggleRef = useRef(false);
  const channelResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const dateDropdownsRef = useRef<HTMLDivElement | null>(null);
  const tableWrapRef = useRef<HTMLElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const stickyHeaderRef = useRef<HTMLDivElement | null>(null);

  const draftStartParts = useMemo(() => splitDate(draftStartDate), [draftStartDate]);
  const draftEndParts = useMemo(() => splitDate(draftEndDate), [draftEndDate]);
  const isFromDateDirty = draftStartDate !== startDate;
  const isToDateDirty = draftEndDate !== endDate;
  const isDateRangeDirty = isFromDateDirty || isToDateDirty;

  const selectStyles = {
    control: (base: any) => ({
      ...base,
      minHeight: 34,
      height: 34,
      borderRadius: 999,
      borderColor: themeMode === 'light' ? '#d8dce5' : '#303134',
      backgroundColor: themeMode === 'light' ? '#ffffff' : '#17181b',
      boxShadow: 'none',
      cursor: 'pointer',
    }),
    valueContainer: (base: any) => ({ ...base, padding: '0 10px', height: 34 }),
    indicatorsContainer: (base: any) => ({ ...base, height: 34 }),
    indicatorSeparator: () => ({ display: 'none' }),
    singleValue: (base: any) => ({
      ...base,
      color: themeMode === 'light' ? '#141924' : '#e6e6e6',
      fontSize: 12,
      fontWeight: 600,
    }),
    menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
    menu: (base: any) => ({
      ...base,
      zIndex: 9999,
      backgroundColor: themeMode === 'light' ? '#ffffff' : '#17181b',
      border: themeMode === 'light' ? '1px solid #d8dce5' : '1px solid #303134',
      boxShadow:
        themeMode === 'light' ? '0 12px 30px rgba(17, 24, 39, 0.12)' : '0 12px 30px rgba(0, 0, 0, 0.45)',
    }),
    option: (base: any, state: any) => ({
      ...base,
      fontSize: 12,
      fontWeight: 600,
      backgroundColor: state.isFocused
        ? themeMode === 'light'
          ? '#eef2f8'
          : '#1F2023'
        : themeMode === 'light'
          ? '#ffffff'
          : '#17181b',
      color: themeMode === 'light' ? '#141924' : '#e6e6e6',
      cursor: 'pointer',
    }),
    input: (base: any) => ({ ...base, color: themeMode === 'light' ? '#141924' : '#e6e6e6' }),
    dropdownIndicator: (base: any) => ({ ...base, color: themeMode === 'light' ? '#64748b' : '#a8a9ad' }),
  };

  const selectPortalTarget = typeof window !== 'undefined' ? document.body : null;

  useEffect(() => {
    if (!isNested && !authChecked) return;
    if (!isNested && !user) return;

    if (initialRows) {
      setRows(initialRows);
      setLoading(false);
    } else {
      load();
    }
  }, [sourceFilter, startDate, endDate, currency, initialRows, apiUrl, isNested, authChecked, user]);

  useEffect(() => {
    if (isNested) return;
    const saved = window.localStorage.getItem('dashboard-theme');
    const attr = document.documentElement.getAttribute('data-dashboard-theme') as ThemeMode | null;
    
    const themeToSet = saved || attr || 'light';
    if (themeToSet === 'light' || themeToSet === 'night') {
      setThemeMode(themeToSet);
    }
  }, [isNested]);

  useEffect(() => {
    if (isNested) return;
    window.localStorage.setItem('dashboard-theme', themeMode);
  }, [themeMode, isNested]);

  useEffect(() => {
    if (isNested) return;
    try {
      localStorage.setItem('dashboard-startDate', startDate);
      localStorage.setItem('dashboard-endDate', endDate);
    } catch {}
  }, [startDate, endDate, isNested]);

  useEffect(() => {
    if (isNested) return;
    try { localStorage.setItem('dashboard-currency', currency); } catch {}
  }, [currency, isNested]);

  useEffect(() => {
    if (isNested) return;
    try { localStorage.setItem('dashboard-sourceFilter', sourceFilter); } catch {}
  }, [sourceFilter, isNested]);

  useEffect(() => {
    if (isNested) return;
    document.documentElement.setAttribute('data-dashboard-theme', themeMode);
    document.body.setAttribute('data-dashboard-theme', themeMode);

    return () => {
      document.documentElement.removeAttribute('data-dashboard-theme');
      document.body.removeAttribute('data-dashboard-theme');
    };
  }, [themeMode, isNested]);

  useEffect(() => {
    const updateStickyHeader = () => {
      const wrap = tableWrapRef.current;
      const table = tableRef.current;
      if (!wrap || !table) return;

      const rect = wrap.getBoundingClientRect();
      const stickyHeight = stickyHeaderRef.current?.offsetHeight ?? 0;
      setStickyHeaderVisible(rect.top <= 0 && rect.bottom > stickyHeight);
      setStickyHeaderLeft(rect.left);
      setStickyHeaderWidth(rect.width);
      setTablePixelWidth(table.getBoundingClientRect().width);
    };

    updateStickyHeader();

    const resizeObserver = new ResizeObserver(() => {
      updateStickyHeader();
    });

    if (tableWrapRef.current) resizeObserver.observe(tableWrapRef.current);
    if (tableRef.current) resizeObserver.observe(tableRef.current);

    window.addEventListener('scroll', updateStickyHeader, { passive: true });
    window.addEventListener('resize', updateStickyHeader);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('scroll', updateStickyHeader);
      window.removeEventListener('resize', updateStickyHeader);
    };
  }, [channelColWidth, rows.length]);

  useEffect(() => {
    const stopSelection = () => {
      setIsSelecting(false);
      setSelectionAnchor(null);
      setTimeout(() => {
        suppressRowToggleRef.current = false;
      }, 50); // Increased slightly for safer row toggle suppression
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedCells(new Set());
        setOpenDateDropdown(null);
      }
    };

    window.addEventListener('mouseup', stopSelection);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mouseup', stopSelection);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const onDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;

      // 1. Handle date dropdowns
      if (openDateDropdown) {
        if (!dateDropdownsRef.current?.contains(target)) {
          setOpenDateDropdown(null);
        }
      }

      // 2. Handle cell selection clearing
      // If we are NOT clicking a cell (td or its children), clear selection
      const isCell = (target instanceof HTMLElement && target.closest('td'));
      if (!isCell && selectedCells.size > 0) {
        setSelectedCells(new Set());
      }
    };

    document.addEventListener('mousedown', onDocumentMouseDown);
    return () => document.removeEventListener('mousedown', onDocumentMouseDown);
  }, [openDateDropdown, selectedCells.size]);

  useEffect(() => {
    if (!isResizingChannel) return;

    const onMouseMove = (event: MouseEvent) => {
      if (!channelResizeRef.current) return;
      const deltaX = event.clientX - channelResizeRef.current.startX;
      const nextWidth = Math.max(
        MIN_CHANNEL_WIDTH,
        Math.min(MAX_CHANNEL_WIDTH, channelResizeRef.current.startWidth + deltaX)
      );
      setChannelColWidth(nextWidth);
    };

    const onMouseUp = () => {
      setIsResizingChannel(false);
      channelResizeRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingChannel]);

  function startChannelResize(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    channelResizeRef.current = {
      startX: event.clientX,
      startWidth: channelColWidth,
    };
    setIsResizingChannel(true);
  }

  async function load(overrides?: {
    startDate?: string;
    endDate?: string;
    currency?: Currency;
    sourceFilter?: SourceFilter;
  }) {
    const requestCurrency = overrides?.currency ?? currency;
    const requestStartDate = overrides?.startDate ?? startDate;
    const requestEndDate = overrides?.endDate ?? endDate;
    const requestSourceFilter = overrides?.sourceFilter ?? sourceFilter;

    setLoading(true);
    setError(null);
    try {
      const channelsForQuery =
        requestSourceFilter === 'all'
          ? CHANNELS
          : CHANNELS.filter((channel) => channel === requestSourceFilter);

      const activeChannels = channelsForQuery.map((name) =>
        name === 'Facebook / Target Point' ? 'Facebook' : name
      );

      const qs = new URLSearchParams({
        currency: requestCurrency,
        startDate: requestStartDate,
        endDate: requestEndDate,
        channels: activeChannels.join(','),
      });

      const separator = apiUrl.includes('?') ? '&' : '?';
      const res = await fetch(`${apiUrl}${separator}${qs.toString()}`, { cache: 'no-store' });

      if (res.status === 401) {
        window.location.replace('/login');
        return;
      }

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Request failed');

      const incoming: Row[] = (json.data || []).map((r: Row) => ({ ...r, channel: normalizeChannel(r.channel) }));
      setRows(incoming);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unexpected error');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  function toggleDateDropdown(kind: 'from' | 'to') {
    setOpenDateDropdown((prev) => (prev === kind ? null : kind));
  }

  async function applyDateRangeDraft() {
    const nextStartDate = draftStartDate;
    const nextEndDate = draftEndDate;
    setStartDate(nextStartDate);
    setEndDate(nextEndDate);
    onDateChange?.(nextStartDate, nextEndDate);
    setOpenDateDropdown(null);
    await load({ startDate: nextStartDate, endDate: nextEndDate });
  }

  function requestSort(next: SortKey) {
    if (sortKey === next) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(next);
    setSortDirection(next === 'channel' ? 'asc' : 'desc');
  }

  const displayRows = useMemo(() => {
    if (loading && rows.length === 0) {
        return Array.from({ length: 12 }).map((_, i) => ({
            type: 'channel' as const,
            row: { channel: '' } as any,
            key: `skeleton-${i}`,
            hasChildren: false,
        }));
    }

    const byChannel: Record<string, Row[]> = {};
    for (const r of rows) {
      if (!byChannel[r.channel]) byChannel[r.channel] = [];
      byChannel[r.channel].push(r);
    }

    const channelRows: Array<{ channel: string; total: Row; index: number; grouped: Row[] }> = [];

    // Calculate channels dynamically based on data
    const dataChannels = Array.from(new Set(rows.map(r => r.channel))).filter(c => (c !== 'TOTAL' && !c.startsWith('Skeleton')));
    let displayChannels: string[] = [];
    
    // Default channels only for the main unnested marketing dashboard
    if (!isNested && apiUrl === '/api/marketing' && dataChannels.length === 0 && !loading) {
      displayChannels = [...SOURCE_CHANNELS];
    } else {
      displayChannels = dataChannels;
    }
    

    displayChannels.forEach((channel, idx) => {
      const grouped = byChannel[channel] || [];
      const total = aggregateRows(grouped, channel, idx + 1);

      channelRows.push({ channel, total, index: idx, grouped });
    });

    if (sortKey !== 'channel') {
      channelRows.sort((a, b) => {
        if (a.channel === 'TOTAL') return 1;
        if (b.channel === 'TOTAL') return -1;

        const av = a.total[sortKey] ?? 0;
        const bv = b.total[sortKey] ?? 0;
        const na = Number(av);
        const nb = Number(bv);
        return sortDirection === 'asc' ? na - nb : nb - na;
      });
    }

    // Add TOTAL row at the bottom
    const allLeadsRows = channelRows.map(cr => cr.total).filter(r => r.channel !== 'TOTAL');
    if (allLeadsRows.length > 0 && sourceFilter === 'all') {
        const totalRow = aggregateRows(allLeadsRows, 'TOTAL', 100);
        channelRows.push({ channel: 'TOTAL', total: totalRow, index: 100, grouped: [] });
    }

    const out: Array<{
      type: 'channel' | 'detail';
      row: Row;
      key: string;
      label?: string;
      detailDepth?: number;
      detailKey?: string;
      hasChildren?: boolean;
    }> = [];

    channelRows.forEach(({ channel, total, index, grouped }) => {
      const hasAnyLevelData = grouped.some((r) => r.level_1 || r.level_2 || r.level_3);
      out.push({ type: 'channel', row: total, key: `channel-${channel}`, hasChildren: hasAnyLevelData });

      if (!expanded[channel]) return;
      if (!hasAnyLevelData) return;

      // Standard hierarchical drilldown for all channels

      const level1Map = new Map<string, Row[]>();
      grouped.forEach((r) => {
        const l1 = levelLabel(r.level_1);
        if (!level1Map.has(l1)) level1Map.set(l1, []);
        level1Map.get(l1)!.push(r);
      });

      // Sort drilldown rows by leads descending
      const sortedLevel1 = Array.from(level1Map.entries()).sort((a, b) => {
        const tA = aggregateRows(a[1], channel, 0);
        const tB = aggregateRows(b[1], channel, 0);
        return tB.leads - tA.leads || tB.no_answer_spam - tA.no_answer_spam || a[0].localeCompare(b[0]);
      });

      for (const [l1Label, l1Rows] of sortedLevel1) {
        const level1Key = `${channel}|${l1Label}`;

        const level2Map = new Map<string, Row[]>();
        l1Rows.forEach((r) => {
          const level2 = r.level_2?.trim();
          if (!level2) return;
          if (!level2Map.has(level2)) level2Map.set(level2, []);
          level2Map.get(level2)!.push(r);
        });

        out.push({
          type: 'detail',
          row: aggregateRows(l1Rows, channel, index + 1),
          key: `detail-${level1Key}`,
          label: l1Label,
          detailDepth: 1,
          detailKey: level1Key,
          hasChildren: maxDrilldownLevel > 1 && level2Map.size > 0,
        });

        if (maxDrilldownLevel < 2 || !expandedDetails[level1Key]) continue;

        for (const [l2Label, l2Rows] of level2Map.entries()) {
          const level2Key = `${level1Key}|${l2Label}`;

          const level3Map = new Map<string, Row[]>();
          l2Rows.forEach((r) => {
            const level3 = r.level_3?.trim();
            if (!level3) return;
            if (!level3Map.has(level3)) level3Map.set(level3, []);
            level3Map.get(level3)!.push(r);
          });

          out.push({
            type: 'detail',
            row: aggregateRows(l2Rows, channel, index + 1),
            key: `detail-${level2Key}`,
            label: l2Label,
            detailDepth: 2,
            detailKey: level2Key,
            hasChildren: maxDrilldownLevel > 2 && level3Map.size > 0,
          });

          if (maxDrilldownLevel < 3 || !expandedDetails[level2Key]) continue;

          for (const [l3Label, l3Rows] of level3Map.entries()) {
            const level3Key = `${level2Key}|${l3Label}`;
            out.push({
              type: 'detail',
              row: aggregateRows(l3Rows, channel, index + 1),
              key: `detail-${level3Key}`,
              label: l3Label,
              detailDepth: 3,
              detailKey: level3Key,
              hasChildren: false,
            });
          }
        }
      }
    });

    return out;
  }, [expanded, expandedDetails, rows, sortDirection, sortKey, sourceFilter, maxDrilldownLevel]);

  const showTableSkeletons = loading;
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const visibleRows = useMemo(() => {
    if (!normalizedSearchQuery) return displayRows;

    return displayRows.filter(({ row, label }) => {
      const haystack = [row.channel, label, row.level_1, row.level_2, row.level_3]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedSearchQuery);
    });
  }, [displayRows, normalizedSearchQuery]);

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

  function toggleExpanded(ch: string) {
    setExpanded((s) => ({ ...s, [ch]: !s[ch] }));
  }

  function toggleDetail(detailKey: string) {
    setExpandedDetails((s) => ({ ...s, [detailKey]: !s[detailKey] }));
  }

  function rangeSelection(anchor: { rowIndex: number; colIndex: number }, current: { rowIndex: number; colIndex: number }) {
    const minRow = Math.min(anchor.rowIndex, current.rowIndex);
    const maxRow = Math.max(anchor.rowIndex, current.rowIndex);
    const minCol = Math.min(anchor.colIndex, current.colIndex);
    const maxCol = Math.max(anchor.colIndex, current.colIndex);
    const next = new Set<string>();

    for (let r = minRow; r <= maxRow; r += 1) {
      for (let c = minCol; c <= maxCol; c += 1) {
        next.add(`${r}:${c}`);
      }
    }

    return next;
  }

  function handleCellMouseDown(event: React.MouseEvent<HTMLTableCellElement>, rowIndex: number, colIndex: number) {
    event.preventDefault();
    // Removed stopPropagation to allow document-level click handlers (like closing dropdowns) to trigger
    suppressRowToggleRef.current = true;
    const anchor = { rowIndex, colIndex };
    setSelectionAnchor(anchor);
    setIsSelecting(true);
    setSelectedCells(rangeSelection(anchor, anchor));
  }

  function handleCellMouseEnter(rowIndex: number, colIndex: number) {
    if (!isSelecting || !selectionAnchor) return;
    setSelectedCells(rangeSelection(selectionAnchor, { rowIndex, colIndex }));
  }

  function handleCellMouseUp(event: React.MouseEvent<HTMLTableCellElement>) {
    event.stopPropagation();
    setIsSelecting(false);
    setSelectionAnchor(null);
    setTimeout(() => {
      suppressRowToggleRef.current = false;
    }, 0);
  }

  const dashboardContent = (
    <div className={`${styles.mainPane} ${sidebarCompact ? styles.mainPaneCompact : isNested ? styles.nestedPane : ''}`}>

          <div className={styles.shell}>
        {!isNested && (
          <div className={styles.stickyHeaderContent}>
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
                <span className={styles.themeSwitchLabel}>{themeMode === 'night' ? 'Night' : 'Light'}</span>
                <button
                  type="button"
                  className={`${styles.themeSwitch} ${themeMode === 'light' ? styles.themeSwitchLight : ''}`}
                  onClick={() => setThemeMode((prev) => (prev === 'night' ? 'light' : 'night'))}
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

            {!hideFilters && (
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
                      {SOURCE_CHANNELS.map((ch) => (
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
                                options={DAY_OPTIONS}
                                styles={selectStyles}
                                value={DAY_OPTIONS.find((d) => d.value === draftStartParts.day)}
                                onChange={(option) => {
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
                                options={MONTH_OPTIONS}
                                styles={selectStyles}
                                value={MONTH_OPTIONS.find((m) => m.value === draftStartParts.month)}
                                onChange={(option) => {
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
                                options={YEAR_OPTIONS}
                                styles={selectStyles}
                                value={YEAR_OPTIONS.find((y) => y.value === draftStartParts.year)}
                                onChange={(option) => {
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
                              onClick={() => void applyDateRangeDraft()}
                            >
                              <Check size={14} />
                            </button>
                          ) : null}
                          {(startDate !== '2024-01-01' || endDate !== today) && (
                            <button
                              type="button"
                              className={styles.dateApplyBtn}
                              style={{ background: '#f1f5f9', color: '#64748b', borderColor: '#e2e8f0', boxShadow: 'none' }}
                              onClick={() => {
                                setStartDate('2024-01-01');
                                setEndDate(today);
                                setDraftStartDate('2024-01-01');
                                setDraftEndDate(today);
                                onDateChange?.('2024-01-01', today);
                              }}
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
                                options={DAY_OPTIONS}
                                styles={selectStyles}
                                value={DAY_OPTIONS.find((d) => d.value === draftEndParts.day)}
                                onChange={(option) => {
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
                                options={MONTH_OPTIONS}
                                styles={selectStyles}
                                value={MONTH_OPTIONS.find((m) => m.value === draftEndParts.month)}
                                onChange={(option) => {
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
                                options={YEAR_OPTIONS}
                                styles={selectStyles}
                                value={YEAR_OPTIONS.find((y) => y.value === draftEndParts.year)}
                                onChange={(option) => {
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
            )}
          </div>
        )}

        {error ? <div className={styles.error}>{error}</div> : null}
        {!isNested && extraContent}

        {!hideTable && (
          <>
            {title && <h2 className={styles.tableTitle}>{title}</h2>}
            <section className={styles.tableWrap} ref={tableWrapRef}>
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
            onScroll={(event) => setTableScrollLeft(event.currentTarget.scrollLeft)}
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
                    if (col.key === 'date') return renderValue(val, 'date');
                    if (col.key === 'leads') return renderValue(val, 'num');
                    if (col.key === 'cpl') return renderValue(val, 'money', currency);
                    if (col.key === 'no_answer_spam') return renderValue(val, 'num');
                    if (col.key === 'rate_answer') {
                      const ansVal = Number(val) || 0;
                      return <span className={ansVal < 0.2 && ansVal > 0 ? styles.roiNegative : ''}>{renderValue(val, 'pct')}</span>;
                    }
                    if (col.key === 'qualified_leads') return renderValue(val, 'num');
                    if (col.key === 'cost_per_qualified_leads') return renderValue(val, 'money', currency);
                    if (col.key === 'cr_ql') return renderValue(val, 'pct');
                    if (col.key === 'ql_actual') return renderValue(val, 'num');
                    if (col.key === 'cpql_actual') return renderValue(val, 'money', currency);
                    if (col.key === 'meetings') return renderValue(val, 'num');
                    if (col.key === 'cp_meetings') return renderValue(val, 'money', currency);
                    if (col.key === 'deals') return renderValue(val, 'num');
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
                    if (col.key === 'impressions') return renderValue(val, 'num');
                    if (col.key === 'clicks') return renderValue(val, 'num');
                    if (col.key === 'ctr') return renderValue((row.clicks || 0) / (row.impressions || 1), 'pct', undefined, 2);
                    if (col.key === 'ad_cost') return renderValue(val, 'money', currency);
                    if (col.key === 'sessions') return renderValue(val, 'num');
                    if (col.key === 'bounce_rate') return renderValue(val, 'pct');
                    if (col.key === 'avg_duration') return renderValue(val, 'time');
                    if (col.key === 'cr_lead') return renderValue(((row.leads_crm || 0) + (row.leads_wa || 0)) / (row.sessions || 1), 'pct', undefined, 2);
                    if (col.key === 'leads_crm') return renderValue(val, 'num');
                    if (col.key === 'leads_wa') return renderValue(val, 'num');
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
        </section>
        </>
        )}

        {children}
      </div>
    </div>
  );

  if (isNested) return dashboardContent;

  if (!authChecked) return null;

  return (
    <div className={styles.page} data-theme={themeMode}>
      <div className={styles.layout}>
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
            {filteredSidebarSections.map((section) => (
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
                onClick={async () => {
                    await fetch('/api/auth/logout', { method: 'POST' });
                    window.location.href = '/login';
                }}
             >
                <div className={styles.sidebarItemIcon}>
                    <Users size={18} />
                </div>
                {!sidebarCompact && <span className={styles.sidebarItemLabel}>Выйти</span>}
             </button>
          </div>
        </aside>

        {dashboardContent}
      </div>
    </div>
  );
}

