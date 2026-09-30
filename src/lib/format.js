import { format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns';

const toDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : parseISO(String(value));
  return isValid(date) ? date : null;
};

export const fmtDate = (value, pattern = 'dd MMM yyyy') => {
  const date = toDate(value);
  return date ? format(date, pattern) : '—';
};

export const fmtDateTime = (value) => {
  const date = toDate(value);
  return date ? format(date, 'dd MMM yyyy, HH:mm') : '—';
};

export const fmtDateTimeSeconds = (value) => {
  const date = toDate(value);
  return date ? format(date, 'dd MMM yyyy, HH:mm:ss') : '—';
};

export const fmtRelative = (value) => {
  const date = toDate(value);
  if (!date) return '—';
  return `${formatDistanceToNowStrict(date)} ago`;
};

/** Tokens are whole units; never render them with decimals. */
export const fmtTokens = (value) => {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-IN').format(Math.trunc(value));
};

export const fmtNumber = (value) => {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-IN').format(value);
};

export const fmtMoney = (value, currency = 'INR') => {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
};

/** Paise (integer) → INR currency string. */
export const fmtPaise = (paise, currency = 'INR') => {
  if (paise === null || paise === undefined) return '—';
  return fmtMoney(Number(paise) / 100, currency);
};

/** Signed token delta, so a ledger column reads at a glance. */
export const fmtSigned = (value) => {
  if (value === null || value === undefined) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${fmtTokens(value)}`;
};

/** Seconds as `1h 04m 12s`, dropping empty leading units. */
export const fmtDuration = (totalSeconds) => {
  if (totalSeconds === null || totalSeconds === undefined) return '—';
  const seconds = Math.max(0, Math.trunc(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
};

export const fmtPhone = (countryCode, mobileNumber) =>
  countryCode && mobileNumber ? `${countryCode} ${mobileNumber}` : mobileNumber || '—';

/** Shortens a UUID for dense table cells; full value goes in a title attribute. */
export const shortId = (id) => (id ? `${String(id).slice(0, 8)}…` : '—');

export const titleCase = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

/** Strips empty strings so they are not sent as filters. */
export const cleanParams = (params) =>
  Object.entries(params || {}).reduce((acc, [key, value]) => {
    if (value === '' || value === null || value === undefined) return acc;
    acc[key] = value;
    return acc;
  }, {});
