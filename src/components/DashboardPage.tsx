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
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import FilterBar from '@/components/dashboard/FilterBar';
import DataTable from '@/components/dashboard/DataTable';
import TableSkeleton from '@/components/dashboard/skeletons/TableSkeleton';
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
  level_4?: string | null;
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

const CHANNELS = ['RED', 'Facebook', 'Klykov', 'Website', 'ЮрийНедвижБош', 'Own leads', 'Partners leads', 'ETC'] as const;

type ChannelName = (typeof CHANNELS)[number];
type SourceFilter = 'all' | Exclude<ChannelName, 'TOTAL'>;
export const SOURCE_CHANNELS = CHANNELS.filter((channel) => channel !== 'TOTAL') as Exclude<ChannelName, 'TOTAL'>[];
export const MARKETING_CHANNELS = SOURCE_CHANNELS.map(ch => ({ label: ch, value: ch }));

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
  level_4: null,
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
  const norm = (raw || '').trim();
  if (norm === 'Facebook') return 'Facebook / Target Point';
  return norm;
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

const YEAR_OPTIONS: SelectOption[] = ['2026'].map((year) => ({
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

function formatStatusDateTime(iso: string | null) {
  if (!iso) return 'n/a';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleString('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
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
  hideSidebar = false,
  hideCurrency = false,
  customFilterContent = null,
  customColumns,
  onDateChange,
  icon = <BarChart3 size={14} />,
  FilterComponent = FilterBar,
  customTableStyle,
  layoutVariant = 'marketing',
  queryChannels,
  currency: externalCurrency,
  setCurrency: externalSetCurrency,
  sidebarSections,
  sidebarMinimal = false,
  showDataStatus = false,
  defaultStartDate,
  defaultEndDate,
  forceDefaultDateRange = false,
  datePresetMode = 'default',
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
  hideSidebar?: boolean,
  hideCurrency?: boolean,
  customFilterContent?: React.ReactNode,
  customColumns?: any[],
  onDateChange?: (start: string, end: string) => void;
  icon?: React.ReactNode;
  FilterComponent?: React.FC<any>;
  customTableStyle?: React.CSSProperties;
  layoutVariant?: 'marketing' | 'red';
  queryChannels?: string[];
  currency?: Currency;
  setCurrency?: (val: Currency) => void;
  sidebarSections?: Array<{ title: string; items: Array<{ label: string; icon: any; href?: string }> }>;
  sidebarMinimal?: boolean;
  showDataStatus?: boolean;
  defaultStartDate?: string;
  defaultEndDate?: string;
  forceDefaultDateRange?: boolean;
  datePresetMode?: 'default' | 'plan-fact-months';
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

  const [internalCurrency, setInternalCurrency] = useState<Currency>(() => {
    if (isNested) return 'aed';
    try { return (localStorage.getItem('dashboard-currency') as Currency) || 'aed'; } catch { return 'aed'; }
  });
  const currency = externalCurrency || internalCurrency;
  const setCurrency = externalSetCurrency || setInternalCurrency;
  const [startDate, setStartDate] = useState(() => {
    if (defaultStartDate && forceDefaultDateRange) return defaultStartDate;
    if (isNested) return defaultStartDate || '2026-01-01';
    if (defaultStartDate) return defaultStartDate;
    try {
      const saved = localStorage.getItem('dashboard-startDate');
      // Ignore any saved date before 2026
      return (saved && saved >= '2026-01-01') ? saved : '2026-01-01';
    } catch { return '2026-01-01'; }
  });
  const [endDate, setEndDate] = useState(() => {
    if (defaultEndDate && forceDefaultDateRange) return defaultEndDate;
    if (isNested) return defaultEndDate || today;
    if (defaultEndDate) return defaultEndDate;
    try { return localStorage.getItem('dashboard-endDate') || today; } catch { return today; }
  });
  const [draftStartDate, setDraftStartDate] = useState(() => {
    if (defaultStartDate && forceDefaultDateRange) return defaultStartDate;
    if (isNested) return defaultStartDate || '2026-01-01';
    if (defaultStartDate) return defaultStartDate;
    try {
      const saved = localStorage.getItem('dashboard-startDate');
      return (saved && saved >= '2026-01-01') ? saved : '2026-01-01';
    } catch { return '2026-01-01'; }
  });
  const [draftEndDate, setDraftEndDate] = useState(() => {
    if (defaultEndDate && forceDefaultDateRange) return defaultEndDate;
    if (isNested) return defaultEndDate || today;
    if (defaultEndDate) return defaultEndDate;
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
  const [dataStatus, setDataStatus] = useState<{ lastUpdatedAt: string | null; freshnessError: string | null }>({
    lastUpdatedAt: null,
    freshnessError: null,
  });

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
    if (sidebarSections && sidebarSections.length > 0) {
      return sidebarSections;
    }

    if (!user) return NAVIGATION_SECTIONS;
    
    // For partner users, show only their own partner page in sidebar.
    if (user.role === 'partner') {
      const pId = user.partnerId || 'klykov';
      const partnerHref = `/partners/${pId}`;

      const partnerSection = NAVIGATION_SECTIONS.find(section =>
        section.items.some(item => item.href?.startsWith('/partners/'))
      );

      const partnerItem = partnerSection?.items.find(item => item.href === partnerHref);

      if (partnerSection && partnerItem) {
        return [
          {
            ...partnerSection,
            items: [partnerItem],
          },
        ];
      }

      return [];
    }
    
    return NAVIGATION_SECTIONS;
  }, [user, sidebarSections]);

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
      minHeight: 32,
      height: 32,
      borderRadius: 999,
      borderColor: themeMode === 'light' ? '#e2e8f0' : '#303134',
      backgroundColor: themeMode === 'light' ? '#ffffff' : '#17181b',
      boxShadow: 'none',
      cursor: 'pointer',
      padding: '0 8px',
      display: 'flex',
      alignItems: 'center',
      '&:hover': {
        borderColor: themeMode === 'light' ? '#cbd5e1' : '#404144',
      }
    }),
    valueContainer: (base: any) => ({ 
      ...base, 
      padding: '0', 
      height: '32px',
      display: 'grid',
      placeItems: 'center',
    }),
    indicatorsContainer: (base: any) => ({ 
      ...base, 
      height: '32px', 
    }),
    indicatorSeparator: () => ({ display: 'none' }),
    singleValue: (base: any) => ({
      ...base,
      color: themeMode === 'light' ? '#1e293b' : '#f1f5f9',
      fontSize: '12px',
      fontWeight: 700,
      margin: 0,
      padding: 0,
      position: 'static',
      transform: 'none',
    }),
    placeholder: (base: any) => ({
      ...base,
      position: 'static',
      transform: 'none',
      margin: 0,
    }),
    menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
    menu: (base: any) => ({
      ...base,
      zIndex: 9999,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: themeMode === 'light' ? '#ffffff' : '#1f2023',
      border: themeMode === 'light' ? '1px solid #e2e8f0' : '1px solid #303134',
      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.12)',
    }),
    option: (base: any, state: any) => ({
      ...base,
      fontSize: '12px',
      fontWeight: 500,
      textAlign: 'center',
      backgroundColor: state.isSelected
        ? themeMode === 'light' ? '#f1f5f9' : '#303134'
        : state.isFocused
          ? themeMode === 'light' ? '#f8fafc' : '#26272b'
          : 'transparent',
      color: themeMode === 'light' ? '#1e293b' : '#f1f5f9',
      cursor: 'pointer',
    }),
    input: (base: any) => ({ 
      ...base, 
      margin: 0, 
      padding: 0,
      // Ensure input doesn't take space or shift content
      position: 'absolute',
      width: 0,
      opacity: 0,
    }),
    dropdownIndicator: (base: any) => ({ 
      ...base, 
      color: themeMode === 'light' ? '#94a3b8' : '#64748b',
      padding: '0',
    }),
  };

  const selectPortalTarget = typeof window !== 'undefined' ? document.body : null;

  const isFirstMount = useRef(true);

  useEffect(() => {
    if (!isNested && !authChecked) return;
    if (!isNested && !user) return;

    if (initialRows && isFirstMount.current) {
      setRows(initialRows);
      setLoading(false);
      isFirstMount.current = false;
    } else {
      load().then(() => {
        isFirstMount.current = false;
      });
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
      const qs = new URLSearchParams({
        currency: requestCurrency,
        startDate: requestStartDate,
        endDate: requestEndDate,
      });

      if (isNested) {
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
        setDataStatus({
          lastUpdatedAt: json?.meta?.lastUpdatedAt || null,
          freshnessError: json?.meta?.freshnessError || null,
        });
        return;
      }

      const channelsForQuery = (queryChannels && queryChannels.length > 0 ? queryChannels : CHANNELS) as readonly string[];

      const activeChannels = channelsForQuery.map((name) =>
        name === 'Facebook / Target Point' ? 'Facebook' : name
      );

      const mainQs = new URLSearchParams({
        currency: requestCurrency,
        startDate: requestStartDate,
        endDate: requestEndDate,
        channels: activeChannels.join(','),
      });

      const separator = apiUrl.includes('?') ? '&' : '?';
      const res = await fetch(`${apiUrl}${separator}${mainQs.toString()}`, { cache: 'no-store' });

      if (res.status === 401) {
        window.location.replace('/login');
        return;
      }

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Request failed');

      const incoming: Row[] = (json.data || []).map((r: Row) => ({ ...r, channel: normalizeChannel(r.channel) }));
      setRows(incoming);
      setDataStatus({
        lastUpdatedAt: json?.meta?.lastUpdatedAt || null,
        freshnessError: json?.meta?.freshnessError || null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unexpected error');
      setRows([]);
      setDataStatus({ lastUpdatedAt: null, freshnessError: null });
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

  async function setExactDateRange(start: string, end: string) {
    setDraftStartDate(start);
    setDraftEndDate(end);
    setStartDate(start);
    setEndDate(end);
    onDateChange?.(start, end);
    setOpenDateDropdown(null);
    await load({ startDate: start, endDate: end });
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
      const standardKey = r.channel.trim().toUpperCase();
      if (!byChannel[standardKey]) byChannel[standardKey] = [];
      byChannel[standardKey].push(r);
    }

    const channelRows: Array<{ channel: string; total: Row; index: number; grouped: Row[] }> = [];

    // Calculate channels dynamically based on data (using standardized keys)
    const dataChannels = Array.from(new Set(rows.map(r => r.channel.trim().toUpperCase()))).filter(c => (c !== 'TOTAL' && !c.startsWith('SKELETON')));
    
    let displayChannels: string[] = [];
    
    // Default channels only for the main unnested marketing dashboard
    if (!isNested && apiUrl === '/api/marketing' && dataChannels.length === 0 && !loading) {
      displayChannels = [...SOURCE_CHANNELS].map(c => c.toUpperCase());
    } else {
      displayChannels = dataChannels;
    }

    if (sourceFilter !== 'all') {
      const match = dataChannels.find(c => c === sourceFilter.toUpperCase());
      displayChannels = match ? [match] : [sourceFilter.toUpperCase()];
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
      const hasAnyLevelData = channel === 'RED'
        ? grouped.some((r) => !!r.level_1?.trim())
        : grouped.some((r) => r.level_1 || r.level_2 || r.level_3);
      out.push({ type: 'channel', row: total, key: `channel-${channel}`, hasChildren: hasAnyLevelData });

      if (!expanded[channel]) return;
      if (!hasAnyLevelData) return;

      // Standard hierarchical drilldown for all channels

      const level1Map = new Map<string, Row[]>();
      grouped.forEach((r) => {
        if (channel === 'RED' && !r.level_1?.trim()) return;
        if (r.level_1 === '(budget only)') return;
        const l1 = levelLabel(r.level_1);
        if (!level1Map.has(l1)) level1Map.set(l1, []);
        level1Map.get(l1)!.push(r);
      });

      // Sort drilldown rows by active sort column (or leads desc as fallback)
      const sortDetailEntries = <T extends [string, Row[]]>(entries: T[]): T[] => {
        if (sortKey === 'channel') return entries;
        return [...entries].sort((a, b) => {
          const tA = aggregateRows(a[1], channel, 0);
          const tB = aggregateRows(b[1], channel, 0);
          const av = Number((tA as any)[sortKey] ?? 0);
          const bv = Number((tB as any)[sortKey] ?? 0);
          if (av !== bv) return sortDirection === 'asc' ? av - bv : bv - av;
          return a[0].localeCompare(b[0]);
        });
      };
      const sortedLevel1 = sortDetailEntries(Array.from(level1Map.entries()));

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

        const sortedLevel2 = sortDetailEntries(Array.from(level2Map.entries()));
        for (const [l2Label, l2Rows] of sortedLevel2) {
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

          const sortedLevel3 = sortDetailEntries(Array.from(level3Map.entries()));
          for (const [l3Label, l3Rows] of sortedLevel3) {
            const level3Key = `${level2Key}|${l3Label}`;

            const level4Map = new Map<string, Row[]>();
            l3Rows.forEach((r) => {
              const level4 = r.level_4?.trim();
              if (!level4) return;
              if (!level4Map.has(level4)) level4Map.set(level4, []);
              level4Map.get(level4)!.push(r);
            });

            out.push({
              type: 'detail',
              row: aggregateRows(l3Rows, channel, index + 1),
              key: `detail-${level3Key}`,
              label: l3Label,
              detailDepth: 3,
              detailKey: level3Key,
              hasChildren: maxDrilldownLevel > 3 && level4Map.size > 0,
            });

            if (maxDrilldownLevel < 4 || !expandedDetails[level3Key]) continue;

            for (const [l4Label, l4Rows] of level4Map.entries()) {
              const level4Key = `${level3Key}|${l4Label}`;
              out.push({
                type: 'detail',
                row: aggregateRows(l4Rows, channel, index + 1),
                key: `detail-${level4Key}`,
                label: l4Label,
                detailDepth: 4,
                detailKey: level4Key,
                hasChildren: false,
              });
            }
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
    <div className={`${styles.mainPane} ${isNested ? styles.nestedPane : ''}`}>

          <div className={styles.shell}>
        {!isNested && (
          <div className={styles.stickyHeaderContent}>
            <Header 
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              themeMode={themeMode}
              setThemeMode={setThemeMode}
              title={title}
            />

            {!hideFilters && (
              <FilterComponent 
                hideSourceFilter={hideSourceFilter}
                sourceFilter={sourceFilter}
                setSourceFilter={setSourceFilter}
                sourceChannels={SOURCE_CHANNELS as any}
                customFilterContent={customFilterContent}
                dateDropdownsRef={dateDropdownsRef}
                toggleDateDropdown={toggleDateDropdown}
                openDateDropdown={openDateDropdown}
                draftStartParts={draftStartParts}
                draftEndParts={draftEndParts}
                setDraftStartDate={setDraftStartDate}
                setDraftEndDate={setDraftEndDate}
                isDateRangeDirty={isDateRangeDirty}
                applyDateRangeDraft={applyDateRangeDraft}
                setExactDateRange={setExactDateRange}
                startDate={startDate}
                endDate={endDate}
                today={today}
                onResetFilters={() => {
                  const resetStart = defaultStartDate || '2024-01-01';
                  const resetEnd = defaultEndDate || today;
                  setStartDate(resetStart);
                  setEndDate(resetEnd);
                  setDraftStartDate(resetStart);
                  setDraftEndDate(resetEnd);
                  onDateChange?.(resetStart, resetEnd);
                }}
                hideCurrency={hideCurrency}
                currency={currency}
                setCurrency={setCurrency}
                selectStyles={selectStyles}
                selectPortalTarget={selectPortalTarget}
                dayOptions={DAY_OPTIONS}
                monthOptions={MONTH_OPTIONS}
                yearOptions={YEAR_OPTIONS}
                mergeDate={mergeDate}
                layoutVariant={layoutVariant}
                datePresetMode={datePresetMode}
              />
            )}
          </div>
        )}

        {error ? <div className={styles.error}>{error}</div> : null}
        {!isNested && showDataStatus ? (
          <div className={`${styles.dataStatus} ${dataStatus.freshnessError ? styles.dataStatusError : styles.dataStatusOk}`}>
            <span>Last update: {formatStatusDateTime(dataStatus.lastUpdatedAt)}</span>
            <span>{dataStatus.freshnessError ? `ERROR: ${dataStatus.freshnessError}` : 'Status: OK'}</span>
          </div>
        ) : null}
        {!isNested && extraContent}

        {!hideTable && (
          <div style={customTableStyle}>
            {showTableSkeletons && visibleRows.length === 0 ? (
              <TableSkeleton cols={activeColumns.length} />
            ) : (
              <DataTable 
              activeColumns={activeColumns}
              requestSort={requestSort}
              sortKey={sortKey}
              sortDirection={sortDirection}
              startChannelResize={startChannelResize}
              stickyHeaderVisible={stickyHeaderVisible}
              stickyHeaderRef={stickyHeaderRef}
              stickyHeaderLeft={stickyHeaderLeft}
              stickyHeaderWidth={stickyHeaderWidth}
              channelColWidth={channelColWidth}
              tableMinWidth={tableMinWidth}
              tablePixelWidth={tablePixelWidth}
              tableScrollLeft={tableScrollLeft}
              tableWrapRef={tableWrapRef}
              tableScrollRef={tableScrollRef}
              tableRef={tableRef}
              onScroll={(event) => setTableScrollLeft(event.currentTarget.scrollLeft)}
              showTableSkeletons={showTableSkeletons}
              visibleRows={visibleRows}
              expanded={expanded}
              expandedDetails={expandedDetails}
              toggleExpanded={toggleExpanded}
              toggleDetail={toggleDetail}
              currency={currency}
              selectedCells={selectedCells}
              handleCellMouseDown={handleCellMouseDown}
              handleCellMouseEnter={handleCellMouseEnter}
              handleCellMouseUp={handleCellMouseUp}
              suppressRowToggleRef={suppressRowToggleRef}
              renderValue={renderValue}
              formatPercentRatio={formatPercentRatio}
              formatMoney={formatMoney}
              OTHER_FALLBACK_LABEL={OTHER_FALLBACK_LABEL}
              OTHER_FALLBACK_HINT={OTHER_FALLBACK_HINT}
              title={title}
              icon={icon}
            />
            )}
          </div>
        )}

        {children}
      </div>
    </div>
  );

  if (isNested) return dashboardContent;

  if (!isNested && !authChecked) {
    return (
      <div className={styles.page} data-theme={themeMode}>
        <div className={styles.layout} style={{ justifyContent: 'center', alignItems: 'center' }}>
           <div style={{ color: 'var(--muted)', fontSize: '14px' }}>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page} data-theme={themeMode}>
      <div className={styles.layout}>
        {!hideSidebar && (
          <Sidebar 
            sections={filteredSidebarSections}
            user={user}
            minimalMode={sidebarMinimal}
            onLogout={async () => {
                await fetch('/api/auth/logout', { method: 'POST' });
                window.location.href = '/login';
            }}
          />
        )}

        {dashboardContent}
      </div>
    </div>
  );
}

