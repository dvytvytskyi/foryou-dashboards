export type CurrencyCode = 'aed' | 'usd';

const AED_TO_USD = 3.673;

export function formatMoney(value: number, currency: CurrencyCode = 'usd') {
  const converted = currency === 'usd' ? (value || 0) / AED_TO_USD : (value || 0);
  const symbol = currency === 'usd' ? '$' : 'AED';
  return `${symbol} ${Math.round(converted).toLocaleString('en-US')}`;
}

export function formatNumber(value: number) {
  return Math.round(value || 0).toLocaleString('en-US');
}

export function formatCompactNumber(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return String(Math.round(value || 0));
}

export function formatPercent(value: number, digits = 1) {
  if (!Number.isFinite(value)) return '-';
  return `${value.toFixed(digits)}%`;
}

export function formatPercentRatio(value: number, digits = 1) {
  return `${((value || 0) * 100).toFixed(digits)}%`;
}

export function formatDurationSeconds(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}