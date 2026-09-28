import { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Clock,
  Calendar,
  Radio,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  UserCheck,
  TrendingUp,
} from 'lucide-react';
import { listenersApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { Pagination } from '../components/DataTable';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
  Select,
} from '../components/ui';
import { useTableState } from '../hooks/useTableState';
import { fmtDateTime } from '../lib/format';

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function MetricCard({ icon: Icon, label, value, sub, tone = 'brand' }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    sky: 'bg-sky-50 text-sky-600',
  };

  return (
    <div className="flex items-start gap-3.5 rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tones[tone] || tones.brand}`}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink-500">{label}</p>
        <p className="mt-0.5 truncate text-xl font-semibold tabular text-ink-900">{value}</p>
        {sub && <p className="mt-0.5 truncate text-xs text-ink-500">{sub}</p>}
      </div>
    </div>
  );
}

const toMonthValue = (d = new Date()) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

const formatMonthLabel = (monthValue) => {
  const match = String(monthValue || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return 'Select month';
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return 'Select month';
  return `${MONTH_LABELS[monthIndex]} ${year}`;
};

/** Custom month/year calendar — any past year, no future months. */
function MonthYearPicker({ value, maxValue, onChange }) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const max = maxValue || toMonthValue();
  const maxYear = Number(max.slice(0, 4));
  const maxMonthIndex = Number(max.slice(5, 7)) - 1;

  const selectedYear = Number(String(value || max).slice(0, 4)) || maxYear;
  const selectedMonthIndex = Number(String(value || max).slice(5, 7)) - 1;
  const [viewYear, setViewYear] = useState(selectedYear);

  useEffect(() => {
    if (open) setViewYear(selectedYear);
  }, [open, selectedYear]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const canGoNextYear = viewYear < maxYear;
  const minYear = 2015;

  const pickMonth = (monthIndex) => {
    const next = `${viewYear}-${String(monthIndex + 1).padStart(2, '0')}`;
    if (next > max) return;
    onChange(next);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border-0 bg-white px-3 py-2 text-left text-sm text-ink-900 shadow-sm ring-1 ring-inset ring-ink-300 transition hover:bg-ink-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Calendar className="size-4 shrink-0 text-brand-600" />
          <span className="truncate font-medium">{formatMonthLabel(value)}</span>
        </span>
        <ChevronDown className={`size-4 shrink-0 text-ink-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 z-40 mt-2 w-[min(100vw-2rem,24rem)] overflow-hidden rounded-xl border border-ink-200 bg-white shadow-xl ring-1 ring-black/5">
          <div className="border-b border-ink-100 bg-gradient-to-b from-ink-50 to-white px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                aria-label="Previous year"
                disabled={viewYear <= minYear}
                onClick={() => setViewYear((y) => Math.max(minYear, y - 1))}
                className="inline-flex size-8 items-center justify-center rounded-lg text-ink-600 transition hover:bg-white hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronLeft className="size-4" />
              </button>
              <div className="text-center">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Year</p>
                <p className="text-lg font-semibold tabular text-ink-900">{viewYear}</p>
              </div>
              <button
                type="button"
                aria-label="Next year"
                disabled={!canGoNextYear}
                onClick={() => setViewYear((y) => Math.min(maxYear, y + 1))}
                className="inline-flex size-8 items-center justify-center rounded-lg text-ink-600 transition hover:bg-white hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 p-3">
            {MONTH_LABELS.map((label, monthIndex) => {
              const candidate = `${viewYear}-${String(monthIndex + 1).padStart(2, '0')}`;
              const disabled = candidate > max;
              const selected =
                viewYear === selectedYear && monthIndex === selectedMonthIndex;
              const isCurrent =
                viewYear === maxYear && monthIndex === maxMonthIndex;

              return (
                <button
                  key={label}
                  type="button"
                  disabled={disabled}
                  onClick={() => pickMonth(monthIndex)}
                  className={[
                    'rounded-lg px-2 py-2.5 text-sm font-medium transition',
                    disabled
                      ? 'cursor-not-allowed text-ink-300'
                      : selected
                        ? 'bg-brand-600 text-white shadow-sm'
                        : isCurrent
                          ? 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200 hover:bg-brand-100'
                          : 'text-ink-700 hover:bg-ink-100',
                  ].join(' ')}
                >
                  {label.slice(0, 3)}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-ink-100 bg-ink-50/70 px-3 py-2">
            <button
              type="button"
              onClick={() => {
                onChange(max);
                setViewYear(maxYear);
                setOpen(false);
              }}
              className="text-xs font-medium text-brand-700 hover:text-brand-800"
            >
              This month
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-ink-500 hover:text-ink-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Local preview of Mon–Sun weeks overlapping a month (matches backend UTC week rules). */
function listWeeksForMonthLocal(month) {
  const match = String(month || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return [];
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const monthStart = new Date(Date.UTC(year, monthIndex, 1));
  const monthEnd = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));

  const startOfMonday = (value) => {
    const day = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
    const dow = day.getUTCDay();
    day.setUTCDate(day.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
    return day;
  };
  const toKey = (d) => d.toISOString().slice(0, 10);

  let cursor = startOfMonday(monthStart);
  const weeks = [];
  while (cursor.getTime() <= monthEnd.getTime()) {
    const weekStart = new Date(cursor.getTime());
    const weekEnd = new Date(weekStart.getTime());
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    if (weekEnd.getTime() >= monthStart.getTime()) {
      weeks.push({
        week: weeks.length + 1,
        weekStart: toKey(weekStart),
        weekEnd: toKey(weekEnd),
        label: `Week ${weeks.length + 1} (${toKey(weekStart)} → ${toKey(weekEnd)})`,
      });
    }
    cursor = new Date(weekStart.getTime());
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return weeks;
}

function currentWeekNumberForMonth(month) {
  const weeks = listWeeksForMonthLocal(month);
  if (!weeks.length) return 1;
  const now = new Date();
  const dow = now.getUTCDay();
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  const key = monday.toISOString().slice(0, 10);
  return weeks.find((w) => w.weekStart === key)?.week || weeks[weeks.length - 1].week;
}

/** Modal showing detailed daily breakdown and granular session logs for one listener */
function ListenerOnlineTimeDetailModal({ listenerId, month, week, onClose }) {
  const detailParams = { month, week };
  const { data, isLoading, error } = useQuery({
    queryKey: qk.listenerOnlineTimeDetail(listenerId, detailParams),
    queryFn: () => listenersApi.getListenerOnlineTime(listenerId, detailParams),
    enabled: Boolean(listenerId && month && week),
  });

  const listener = data?.listener;
  const summary = data?.summary;
  const dailyBreakdown = data?.dailyBreakdown || [];
  const sessions = data?.sessions || [];

  return (
    <Modal
      open
      onClose={onClose}
      title={listener ? `${listener.displayName || listener.name} — Online Time` : 'Listener online time'}
      description="Daily breakdown and session logs for the selected Mon–Sun week."
      size="xl"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {isLoading && <LoadingBlock label="Loading online session details…" />}
      {error && <ErrorState error={error} />}

      {data && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-ink-200 bg-ink-50/50 p-4">
            <div className="flex items-center gap-3.5">
              <div className="relative">
                {listener.photoUrl ? (
                  <img
                    src={listener.photoUrl}
                    alt=""
                    className="size-12 rounded-full object-cover ring-2 ring-white"
                  />
                ) : (
                  <div className="flex size-12 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700">
                    {(listener.displayName || listener.name || '?').slice(0, 2).toUpperCase()}
                  </div>
                )}
                {listener.online && (
                  <span className="absolute bottom-0 right-0 size-3.5 rounded-full border-2 border-white bg-emerald-500" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-ink-900">{listener.displayName || listener.name}</h4>
                  <Badge tone={listener.online ? 'success' : 'neutral'}>
                    {listener.online ? 'Online now' : 'Offline'}
                  </Badge>
                  {listener.busy && <Badge tone="warning">In Call</Badge>}
                </div>
                <p className="text-xs text-ink-500">{listener.fullMobile}</p>
                {summary?.weekLabel && (
                  <p className="mt-1 text-xs font-medium text-ink-600">{summary.weekLabel}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to={`/listeners/${listener.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 shadow-sm hover:bg-ink-50"
              >
                View profile
                <ExternalLink className="size-3.5" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-ink-100 bg-white p-3.5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wider text-ink-500">Total Online Time</p>
              <p className="mt-1 text-xl font-bold text-ink-900">{summary?.totalOnlineFormatted || '0s'}</p>
              <p className="text-[11px] text-ink-400">{summary?.totalHours || 0} hrs this week</p>
            </div>
            <div className="rounded-xl border border-ink-100 bg-white p-3.5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wider text-ink-500">Total Sessions</p>
              <p className="mt-1 text-xl font-bold text-ink-900">{summary?.totalSessions || 0}</p>
              <p className="text-[11px] text-ink-400">Recorded intervals</p>
            </div>
            <div className="rounded-xl border border-ink-100 bg-white p-3.5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wider text-ink-500">Active Days</p>
              <p className="mt-1 text-xl font-bold text-ink-900">{summary?.activeDaysCount || 0}</p>
              <p className="text-[11px] text-ink-400">Days with online activity</p>
            </div>
            <div className="rounded-xl border border-ink-100 bg-white p-3.5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wider text-ink-500">Daily Average</p>
              <p className="mt-1 text-xl font-bold text-ink-900">
                {summary?.activeDaysCount
                  ? `${(summary.totalHours / summary.activeDaysCount).toFixed(1)} hrs/day`
                  : '0 hrs'}
              </p>
              <p className="text-[11px] text-ink-400">On active days</p>
            </div>
          </div>

          {dailyBreakdown.length > 0 && (
            <div className="space-y-2.5">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                Daily Breakdown
              </h5>
              <div className="overflow-hidden rounded-lg border border-ink-200">
                <table className="min-w-full divide-y divide-ink-200 text-left text-sm">
                  <thead className="bg-ink-50 text-xs font-semibold text-ink-600">
                    <tr>
                      <th className="px-3.5 py-2.5">Date</th>
                      <th className="px-3.5 py-2.5">Online Time</th>
                      <th className="px-3.5 py-2.5">Hours</th>
                      <th className="px-3.5 py-2.5">Sessions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 bg-white">
                    {dailyBreakdown.map((row) => (
                      <tr key={row.date} className="hover:bg-ink-50/50">
                        <td className="px-3.5 py-2 font-medium text-ink-800">{row.date}</td>
                        <td className="px-3.5 py-2 font-semibold text-brand-700">
                          {row.formattedDuration}
                        </td>
                        <td className="px-3.5 py-2 text-ink-600">{row.hours}h</td>
                        <td className="px-3.5 py-2 text-ink-600">{row.sessionCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="space-y-2.5">
            <h5 className="text-xs font-semibold uppercase tracking-wider text-ink-500">
              Session Interval Logs ({sessions.length})
            </h5>
            {sessions.length === 0 ? (
              <p className="py-4 text-center text-xs text-ink-400">No session logs found in this week.</p>
            ) : (
              <div className="max-h-72 overflow-y-auto rounded-lg border border-ink-200">
                <table className="min-w-full divide-y divide-ink-200 text-left text-xs">
                  <thead className="sticky top-0 bg-ink-50 font-semibold text-ink-600">
                    <tr>
                      <th className="px-3 py-2">Started At</th>
                      <th className="px-3 py-2">Ended At</th>
                      <th className="px-3 py-2">Duration</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 bg-white">
                    {sessions.map((s) => (
                      <tr key={s.id} className="hover:bg-ink-50/50">
                        <td className="px-3 py-2 font-mono text-ink-700">{fmtDateTime(s.startedAt)}</td>
                        <td className="px-3 py-2 font-mono text-ink-700">
                          {s.endedAt ? fmtDateTime(s.endedAt) : <span className="font-medium text-emerald-600">Ongoing</span>}
                        </td>
                        <td className="px-3 py-2 font-semibold text-ink-900">{s.durationFormatted}</td>
                        <td className="px-3 py-2">
                          <Badge tone={s.isOngoing ? 'success' : 'neutral'} size="sm">
                            {s.isOngoing ? 'Live Session' : 'Completed'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-ink-500">{s.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

export function ListenerOnlineTimePage() {
  const initialMonth = toMonthValue();
  const [selectedListenerId, setSelectedListenerId] = useState(null);

  const table = useTableState(
    {
      month: initialMonth,
      week: String(currentWeekNumberForMonth(initialMonth)),
      search: '',
      gender: '',
      sortBy: 'totalSeconds',
      sortOrder: 'desc',
    },
    { limit: 20 },
  );

  const weeksForMonth = useMemo(
    () => listWeeksForMonthLocal(table.filters.month),
    [table.filters.month],
  );

  // Keep week in range when month changes.
  useEffect(() => {
    if (!weeksForMonth.length) return;
    const current = Number(table.filters.week);
    if (!weeksForMonth.some((w) => w.week === current)) {
      table.setFilter('week', String(weeksForMonth[weeksForMonth.length - 1].week));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-clamp when month weeks change
  }, [table.filters.month, weeksForMonth]);

  const queryParams = {
    page: table.page,
    limit: table.pageSize,
    month: table.filters.month,
    week: table.filters.week,
    search: table.filters.search || undefined,
    gender: table.filters.gender || undefined,
    sortBy: table.filters.sortBy,
    sortOrder: table.filters.sortOrder,
  };

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: qk.listenerOnlineTime(queryParams),
    queryFn: () => listenersApi.getOnlineTime(queryParams),
  });

  const summary = data?.summary;
  const rows = data?.data || [];
  const pagination = data?.pagination;
  const weekOptions = summary?.weeksInMonth?.length ? summary.weeksInMonth : weeksForMonth;
  const selectedWeek = weekOptions.find((w) => String(w.week) === String(table.filters.week));
  const maxMonth = toMonthValue();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Listener online time"
        description="Week-wise online hours (Monday–Sunday). Pick a month, then a week. Past weeks stay in history."
        actions={
          <Button variant="secondary" onClick={() => refetch()} loading={isFetching}>
            Refresh data
          </Button>
        }
      />

      <Card className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-500">
            <Calendar className="size-3.5" />
            Week filter
          </div>
          <div className="text-xs text-ink-500">
            Selected:{' '}
            <span className="font-semibold text-ink-800">
              {selectedWeek?.label ||
                (summary?.weekStart && summary?.weekEnd
                  ? `${summary.weekStart} → ${summary.weekEnd}`
                  : '—')}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 border-t border-ink-100 pt-2 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-600">Month</label>
            <MonthYearPicker
              value={table.filters.month}
              maxValue={maxMonth}
              onChange={(nextMonth) => {
                if (!nextMonth) return;
                const nextWeeks = listWeeksForMonthLocal(nextMonth);
                const nextWeek =
                  nextWeeks.find((w) => w.week === currentWeekNumberForMonth(nextMonth))?.week ||
                  nextWeeks[nextWeeks.length - 1]?.week ||
                  1;
                table.setManyFilters({ month: nextMonth, week: String(nextWeek) });
              }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-600">Week (Mon–Sun)</label>
            <Select
              value={String(table.filters.week)}
              onChange={(e) => table.setFilter('week', e.target.value)}
            >
              {weekOptions.map((w) => (
                <option key={w.week} value={String(w.week)}>
                  {w.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-600">Search Listener</label>
            <Input
              placeholder="Name or mobile…"
              value={table.filters.search}
              onChange={(e) => table.setFilter('search', e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-600">Gender</label>
            <Select
              value={table.filters.gender}
              onChange={(e) => table.setFilter('gender', e.target.value)}
            >
              <option value="">All genders</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </Select>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total platform online time"
          value={summary ? summary.totalOnlineFormatted : '—'}
          sub={`${summary ? summary.totalOnlineHms : '00:00:00'} this week`}
          icon={Clock}
          tone="brand"
        />
        <MetricCard
          label="Active online now"
          value={summary ? summary.activeListenersCount : '—'}
          sub="Listeners live on discovery"
          icon={Radio}
          tone="emerald"
        />
        <MetricCard
          label="Average per listener"
          value={summary ? summary.averageOnlineFormatted : '—'}
          sub={`${summary ? summary.averageOnlineHours : 0} hrs avg this week`}
          icon={TrendingUp}
          tone="sky"
        />
        <MetricCard
          label="Approved listeners"
          value={summary ? summary.totalListeners : '—'}
          sub="In platform directory"
          icon={UserCheck}
          tone="amber"
        />
      </div>

      <Card>
        {isLoading && <LoadingBlock label="Calculating online time for listeners…" />}
        {error && <ErrorState error={error} />}

        {!isLoading && !error && rows.length === 0 && (
          <EmptyState
            icon={Clock}
            title="No listener activity found"
            description="No online time records matched the selected week or filters."
          />
        )}

        {!isLoading && !error && rows.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-ink-200 text-left text-sm">
                <thead className="bg-ink-50 text-xs font-semibold text-ink-600">
                  <tr>
                    <th className="px-4 py-3.5">Listener</th>
                    <th className="px-4 py-3.5">Mobile</th>
                    <th className="px-4 py-3.5">Live Status</th>
                    <th className="px-4 py-3.5">Total Online Time</th>
                    <th className="px-4 py-3.5">Hours</th>
                    <th className="px-4 py-3.5">Sessions</th>
                    <th className="px-4 py-3.5">Last Online</th>
                    <th className="px-4 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 bg-white">
                  {rows.map((row) => (
                    <tr key={row.listenerId} className="transition hover:bg-ink-50/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative size-9 shrink-0">
                            {row.photoUrl ? (
                              <img
                                src={row.photoUrl}
                                alt=""
                                className="size-9 rounded-full object-cover ring-1 ring-ink-200"
                              />
                            ) : (
                              <div className="flex size-9 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                                {row.displayName.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            {row.online && (
                              <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-white bg-emerald-500" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-ink-900">{row.displayName}</p>
                            {row.name && row.name !== row.displayName && (
                              <p className="text-xs text-ink-400">{row.name}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-600">{row.fullMobile}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {row.online ? (
                            <Badge tone="success">Online</Badge>
                          ) : (
                            <Badge tone="neutral">Offline</Badge>
                          )}
                          {row.busy && <Badge tone="warning">Busy</Badge>}
                          {row.hasOngoingSession && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                              <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                              Active
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-semibold text-brand-700">{row.totalFormatted}</span>
                          <span className="text-[11px] text-ink-400">{row.totalHms}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-ink-800">
                        {row.totalHours > 0 ? `${row.totalHours}h` : '0h'}
                      </td>
                      <td className="px-4 py-3 text-ink-700">{row.sessionCount}</td>
                      <td className="px-4 py-3 text-xs text-ink-500">
                        {row.lastOnlineAt ? fmtDateTime(row.lastOnlineAt) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setSelectedListenerId(row.listenerId)}
                          className="gap-1"
                        >
                          Details
                          <ChevronRight className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="border-t border-ink-100 p-3">
                <Pagination
                  page={pagination.page}
                  limit={pagination.limit}
                  total={pagination.total}
                  totalPages={pagination.totalPages}
                  onPageChange={table.setPage}
                  onLimitChange={table.changeLimit}
                />
              </div>
            )}
          </>
        )}
      </Card>

      {selectedListenerId && (
        <ListenerOnlineTimeDetailModal
          listenerId={selectedListenerId}
          month={table.filters.month}
          week={table.filters.week}
          onClose={() => setSelectedListenerId(null)}
        />
      )}
    </div>
  );
}

export default ListenerOnlineTimePage;
