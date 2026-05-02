export const CLOSED_DEAL_STATUS_IDS = [142, 74717798, 74717802];

// All statuses at "квалификация пройдена" and beyond (inc. отложенный спрос, Реанимация, won)
export const RE_QL_STATUS_IDS = [
  70457466, // квалификация пройдена
  70457470, // презентация назначена
  70457474, // презентация проведена
  70457478, // показ назначен
  70457482, // EOI / чек получен
  70457486, // Документы подписаны (F/SPA)
  70757586, // POST SALES
  74717798, // ПАРТНЕРЫ
  74717802, // ЛИСТИНГ
  70457490, // отложенный спрос
  82310010, // Реанимация
  142,      // квартира оплачена
  143,      // закрыто и не реализовано
];
// Narrow "active" subset — currently in active qualification stages only
// Excludes: POST SALES, ПАРТНЕРЫ, ЛИСТИНГ, отложенный спрос, Реанимация, квартира оплачена, закрыто
export const RE_QL_ACTUAL_STATUS_IDS = [
  70457466, 70457470, 70457474, 70457478, 70457482, 70457486,
];

const RED_SIGNALS = ['red_ru', 'red_eng', 'red_arm', 'red_lux', 'red'];
const KLYKOV_SIGNALS = ['klykov leads', 'alex klykov', 'klykov'];
// Primary Plus = PF offplan leads — AMO tag "pf offplan" (and variants) maps to this category
const PRIMARY_PLUS_SIGNALS = [
  'pf offplan',
  'pf off-plan',
  'pf off plan',
  'primary plus',
];
const PROPERTY_FINDER_SIGNALS = [
  'property finder',
  'property_finder',
  'prian',
  'bayut',
];
const FACEBOOK_SIGNALS = ['facebook', 'meta', 'target point', 'fb'];
const OMAN_SIGNALS = ['oman'];
const PARTNER_SIGNALS = ['partner', 'partners leads', 'партнер', 'партнерка'];

export function normalizeLeadText(value) {
  return String(value || '').trim().toLowerCase();
}

export function extractTagNames(rawTags) {
  return (rawTags || []).map((tag) => tag?.name || '').filter(Boolean);
}

function includesSignal(text, signal) {
  if (!text || !signal) return false;
  return text === signal || text.includes(signal);
}

function hasAnySignal(text, signals) {
  return signals.some((signal) => includesSignal(text, signal));
}

function classifyFromSignals(text, { preferMarketingBuckets = false } = {}) {
  if (!text) return null;
  if (hasAnySignal(text, KLYKOV_SIGNALS)) return 'Klykov';
  if (hasAnySignal(text, RED_SIGNALS)) return 'Red';
  if (hasAnySignal(text, PRIMARY_PLUS_SIGNALS)) return 'Primary Plus';
  if (hasAnySignal(text, PROPERTY_FINDER_SIGNALS)) return 'Property Finder';
  if (hasAnySignal(text, PARTNER_SIGNALS)) return 'Partners leads';
  if (preferMarketingBuckets) {
    if (hasAnySignal(text, [...OMAN_SIGNALS, 'target point'])) return 'Facebook';
  } else {
    if (hasAnySignal(text, OMAN_SIGNALS)) return 'Oman';
    if (hasAnySignal(text, FACEBOOK_SIGNALS)) return 'Facebook';
  }
  return null;
}

export function classifyLeadSource({
  pipelineId,
  sourceValue,
  tags = [],
  utmSource = '',
  leadName = '',
  preferMarketingBuckets = false,
  clientTypeEnumId = null,
  defaultCategory = 'Own leads',
}) {
  if (Number(pipelineId) === 10776450) return 'Klykov';
  if (Number(clientTypeEnumId) === 695223) return 'Partners leads';

  const normalizedSource = normalizeLeadText(sourceValue);
  const normalizedTags = tags.map(normalizeLeadText).filter(Boolean);
  const normalizedUtmSource = normalizeLeadText(utmSource);
  const normalizedLeadName = normalizeLeadText(leadName);

  const sourceCategory = classifyFromSignals(normalizedSource, { preferMarketingBuckets });
  if (sourceCategory) return sourceCategory;
  if (normalizedSource) return 'Own leads';

  const tagBag = normalizedTags.join(' | ');
  const tagCategory = classifyFromSignals(tagBag, { preferMarketingBuckets });
  if (tagCategory) return tagCategory;
  if (tagBag) return 'Own leads';

  const fallbackBag = [normalizedUtmSource, normalizedLeadName].filter(Boolean).join(' | ');
  const fallbackCategory = classifyFromSignals(fallbackBag, { preferMarketingBuckets });
  if (fallbackCategory) return fallbackCategory;
  if (fallbackBag) return 'Own leads';

  return defaultCategory;
}

export function isClosedDealStatus(statusId) {
  return CLOSED_DEAL_STATUS_IDS.includes(Number(statusId));
}

export function hasOmanTag(tags = []) {
  return tags.map(normalizeLeadText).some((tag) => hasAnySignal(tag, OMAN_SIGNALS));
}

/**
 * Returns true if an AMO lead belongs to Primary Plus (PF offplan) channel.
 * Rule: lead has tag "pf offplan" (or close variant) OR source field contains a Primary Plus signal.
 */
export function isPrimaryPlusLead({ tags = [], sourceValue = '' } = {}) {
  const normalizedSource = normalizeLeadText(sourceValue);
  if (hasAnySignal(normalizedSource, PRIMARY_PLUS_SIGNALS)) return true;
  const tagBag = tags.map(normalizeLeadText).join(' | ');
  return hasAnySignal(tagBag, PRIMARY_PLUS_SIGNALS);
}