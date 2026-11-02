import { formatDistanceToNowStrict, isValid, parseISO } from 'date-fns';

/** Admin console wall clock — match backend jobs (Asia/Kolkata, no DST). */
export const ADMIN_TIMEZONE = 'Asia/Kolkata';

const toDate = (value) => {
  if (!value) return null;
  // Bare YYYY-MM-DD = IST calendar day (not browser-local / UTC midnight ambiguity).
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - 5.5 * 60 * 60 * 1000);
  }
  const date = value instanceof Date ? value : parseISO(String(value));
  return isValid(date) ? date : null;
};

const istParts = (date) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: ADMIN_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return {
    day: get('day'),
    month: get('month'),
    year: get('year'),
    hour: get('hour') === '24' ? '00' : get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
};

/** Calendar date in Asia/Kolkata. Optional pattern kept for call-site compatibility. */
export const fmtDate = (value, pattern = 'dd MMM yyyy') => {
  const date = toDate(value);
  if (!date) return '—';
  const { day, month, year } = istParts(date);
  if (pattern === 'yyyy-MM-dd') {
    const m = String(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: ADMIN_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date),
    );
    return m; // en-CA → YYYY-MM-DD
  }
  return `${day} ${month} ${year}`;
};

export const fmtDateTime = (value) => {
  const date = toDate(value);
  if (!date) return '—';
  const { day, month, year, hour, minute } = istParts(date);
  return `${day} ${month} ${year}, ${hour}:${minute}`;
};

export const fmtDateTimeSeconds = (value) => {
  const date = toDate(value);
  if (!date) return '—';
  const { day, month, year, hour, minute, second } = istParts(date);
  return `${day} ${month} ${year}, ${hour}:${minute}:${second}`;
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

/** Inclusive IST Mon–Sun week end calendar day from Monday YYYY-MM-DD. */
export const weekEndDateFromStart = (startDate) => {
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return '';
  const [y, m, d] = startDate.split('-').map(Number);
  const end = new Date(Date.UTC(y, m - 1, d + 6));
  return end.toISOString().slice(0, 10);
};

/** Prefer API IST date fields; fall back to formatting the instant in Kolkata. */
export const fmtPeriodRange = (start, end, startDate = null, endDate = null) => {
  const a = startDate || fmtDate(start, 'yyyy-MM-dd');
  const b = endDate || fmtDate(end, 'yyyy-MM-dd');
  if (!a || a === '—' || !b || b === '—') return '—';
  return `${a} → ${b}`;
};
