import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Clock,
  Calendar,
  Search,
  Activity,
  UserCheck,
  TrendingUp,
  Radio,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { listenersApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { DataTable, FilterBar, Pagination } from '../components/DataTable';
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

/** Quick date range calculation helper */
const getDateRangePresets = () => {
  const now = new Date();
  const formatYmd = (d) => d.toISOString().slice(0, 10);

  const todayStr = formatYmd(now);

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatYmd(yesterday);

  const last7 = new Date(now);
  last7.setDate(last7.getDate() - 6);
  const last7Str = formatYmd(last7);

  const last30 = new Date(now);
  last30.setDate(last30.getDate() - 29);
  const last30Str = formatYmd(last30);

  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startOfMonthStr = formatYmd(startOfMonth);

  return {
    today: { from: todayStr, to: todayStr, label: 'Today' },
    yesterday: { from: yesterdayStr, to: yesterdayStr, label: 'Yesterday' },
    last7: { from: last7Str, to: todayStr, label: 'Last 7 days' },
    last30: { from: last30Str, to: todayStr, label: 'Last 30 days' },
    thisMonth: { from: startOfMonthStr, to: todayStr, label: 'This month' },
  };
};

/** Modal showing detailed daily breakdown and granular session logs for one listener */
function ListenerOnlineTimeDetailModal({ listenerId, from, to, onClose }) {
  const { data, isLoading, error } = useQuery({
    queryKey: typeof qk?.listenerOnlineTimeDetail === 'function'
      ? qk.listenerOnlineTimeDetail(listenerId, { from, to })
      : ['listeners', 'online-time', 'detail', listenerId, { from, to }],
    queryFn: () => listenersApi.getListenerOnlineTime(listenerId, { from, to }),
    enabled: Boolean(listenerId),
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
      description="Daily breakdown and individual online session logs for the selected date range."
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
          {/* Listener Header Profile */}
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

          {/* Quick Summary Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-ink-100 bg-white p-3.5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wider text-ink-500">Total Online Time</p>
              <p className="mt-1 text-xl font-bold text-ink-900">{summary?.totalOnlineFormatted || '0s'}</p>
              <p className="text-[11px] text-ink-400">{summary?.totalHours || 0} hrs in range</p>
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
                  ? (summary.totalHours / summary.activeDaysCount).toFixed(1) + ' hrs/day'
                  : '0 hrs'}
              </p>
              <p className="text-[11px] text-ink-400">On active days</p>
            </div>
          </div>

          {/* Daily Breakdown */}
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

          {/* Granular Session Logs */}
          <div className="space-y-2.5">
            <h5 className="text-xs font-semibold uppercase tracking-wider text-ink-500">
              Session Interval Logs ({sessions.length})
            </h5>
            {sessions.length === 0 ? (
              <p className="py-4 text-center text-xs text-ink-400">No session logs found in this date range.</p>
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
                          {s.endedAt ? fmtDateTime(s.endedAt) : <span className="text-emerald-600 font-medium">Ongoing</span>}
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
  const presets = useMemo(() => getDateRangePresets(), []);
  const [selectedPreset, setSelectedPreset] = useState('last7');
  const [selectedListenerId, setSelectedListenerId] = useState(null);

  const table = useTableState({
    from: presets.last7.from,
    to: presets.last7.to,
    search: '',
    gender: '',
    sortBy: 'totalSeconds',
    sortOrder: 'desc',
    limit: 20,
  });

  const queryParams = {
    page: table.page,
    limit: table.limit,
    from: table.filters.from,
    to: table.filters.to,
    search: table.filters.search || undefined,
    gender: table.filters.gender || undefined,
    sortBy: table.filters.sortBy,
    sortOrder: table.filters.sortOrder,
  };

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: typeof qk?.listenerOnlineTime === 'function'
      ? qk.listenerOnlineTime(queryParams)
      : ['listeners', 'online-time', queryParams],
    queryFn: () => listenersApi.getOnlineTime(queryParams),
  });

  const summary = data?.summary;
  const rows = data?.data || [];
  const pagination = data?.pagination;

  const handlePresetSelect = (key) => {
    setSelectedPreset(key);
    if (presets[key]) {
      table.setFilters({
        from: presets[key].from,
        to: presets[key].to,
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Listener online time"
        description="Monitor active online hours, daily engagement, and session frequencies for approved listeners across custom date ranges."
        actions={
          <Button variant="secondary" onClick={() => refetch()} loading={isFetching}>
            Refresh data
          </Button>
        }
      />

      {/* Date Presets Toolbar */}
      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-500 mr-1 flex items-center gap-1.5">
              <Calendar className="size-3.5" />
              Presets:
            </span>
            {Object.entries(presets).map(([key, p]) => (
              <button
                key={key}
                type="button"
                onClick={() => handlePresetSelect(key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  selectedPreset === key && table.filters.from === p.from && table.filters.to === p.to
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-ink-100 text-ink-700 hover:bg-ink-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs text-ink-500">
            <span>Range:</span>
            <span className="font-semibold text-ink-800">
              {table.filters.from} to {table.filters.to}
            </span>
          </div>
        </div>

        {/* Filter Inputs */}
        <div className="grid grid-cols-1 gap-3 pt-2 border-t border-ink-100 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">From Date</label>
            <Input
              type="date"
              value={table.filters.from}
              onChange={(e) => {
                setSelectedPreset('custom');
                table.setFilter('from', e.target.value);
              }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">To Date</label>
            <Input
              type="date"
              value={table.filters.to}
              onChange={(e) => {
                setSelectedPreset('custom');
                table.setFilter('to', e.target.value);
              }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Search Listener</label>
            <Input
              placeholder="Name or mobile…"
              value={table.filters.search}
              onChange={(e) => table.setFilter('search', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Gender</label>
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

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total platform online time"
          value={summary ? summary.totalOnlineFormatted : '—'}
          sub={`${summary ? summary.totalOnlineHms : '00:00:00'} total tracked`}
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
          sub={`${summary ? summary.averageOnlineHours : 0} hrs avg in range`}
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

      {/* Listeners Online Time Table */}
      <Card>
        {isLoading && <LoadingBlock label="Calculating online time for listeners…" />}
        {error && <ErrorState error={error} />}

        {!isLoading && !error && rows.length === 0 && (
          <EmptyState
            icon={Clock}
            title="No listener activity found"
            description="No online time records matched the current filters or date range."
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
                    <tr key={row.listenerId} className="hover:bg-ink-50/60 transition">
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
                  onLimitChange={table.setLimit}
                />
              </div>
            )}
          </>
        )}
      </Card>

      {/* Detail Dialog */}
      {selectedListenerId && (
        <ListenerOnlineTimeDetailModal
          listenerId={selectedListenerId}
          from={table.filters.from}
          to={table.filters.to}
          onClose={() => setSelectedListenerId(null)}
        />
      )}
    </div>
  );
}
export default ListenerOnlineTimePage;
