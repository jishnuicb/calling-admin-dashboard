import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  BadgeCheck,
  CircleDollarSign,
  Clock,
  Coins,
  Flag,
  PhoneCall,
  Radio,
  Users,
} from 'lucide-react';
import { dashboardApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { Badge, Card, ErrorState, Field, Input, LoadingBlock, PageHeader, Button } from '../components/ui';
import { fmtDuration, fmtMoney, fmtNumber, fmtTokens, titleCase } from '../lib/format';
import { cleanParams } from '../lib/format';

function StatCard({ icon: Icon, label, value, sub, tone = 'brand', to }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    sky: 'bg-sky-50 text-sky-600',
  };

  const body = (
    <div className="flex items-start gap-3.5 rounded-xl border border-ink-200 bg-white p-4 shadow-sm transition hover:border-ink-300">
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>
        <Icon className="size-4.5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink-500">{label}</p>
        <p className="mt-0.5 truncate text-xl font-semibold tabular text-ink-900">{value}</p>
        {sub && <p className="mt-0.5 truncate text-xs text-ink-500">{sub}</p>}
      </div>
    </div>
  );

  return to ? <Link to={to}>{body}</Link> : body;
}

export function DashboardPage() {
  const [range, setRange] = useState({ from: '', to: '' });
  const params = cleanParams(range);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: qk.dashboard(params),
    queryFn: () => dashboardApi.get(params),
    // The dashboard shows "online now" and "in progress now", which go stale fast.
    refetchInterval: 30_000,
  });

  if (isLoading) return <LoadingBlock label="Loading dashboard…" />;

  if (error) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <ErrorState error={error} onRetry={refetch} />
      </>
    );
  }

  const { users, listeners, calls, revenue, tokenSales, weeklyBonus, moderation, listenersPerLanguage, ledger } = data;

  const languageChart = (listenersPerLanguage || []).filter((l) => l.listenerCount > 0).slice(0, 12);
  const openReports = (moderation?.PENDING || 0) + (moderation?.UNDER_REVIEW || 0);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Platform-wide aggregates. Live counters refresh every 30 seconds."
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <Field label="From" className="w-36">
              <Input
                type="date"
                value={range.from}
                onChange={(e) => setRange({ ...range, from: e.target.value })}
              />
            </Field>
            <Field label="To" className="w-36">
              <Input
                type="date"
                value={range.to}
                onChange={(e) => setRange({ ...range, to: e.target.value })}
              />
            </Field>
            {(range.from || range.to) && (
              <Button variant="ghost" size="sm" onClick={() => setRange({ from: '', to: '' })}>
                Clear
              </Button>
            )}
          </div>
        }
      />

      {/* Live operational counters first - these are what an operator watches. */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Radio}
          label="Listeners online now"
          value={fmtNumber(listeners.onlineNow)}
          sub={`${fmtNumber(listeners.approved)} approved in total`}
          tone="emerald"
          to="/listeners?status=APPROVED"
        />
        <StatCard
          icon={Activity}
          label="Calls in progress"
          value={fmtNumber(calls.inProgressNow)}
          sub="Billing is enforced by the sweep"
          tone="sky"
          to="/calls?status=ACTIVE"
        />
        <StatCard
          icon={BadgeCheck}
          label="Pending applications"
          value={fmtNumber(listeners.pendingApplications)}
          sub="Awaiting review"
          tone={listeners.pendingApplications > 0 ? 'amber' : 'brand'}
          to="/listeners?status=PENDING"
        />
        <StatCard
          icon={Flag}
          label="Open reports"
          value={fmtNumber(openReports)}
          sub={`${fmtNumber(moderation?.RESOLVED || 0)} resolved`}
          tone={openReports > 0 ? 'red' : 'brand'}
          to="/moderation?status=PENDING"
        />
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Users}
          label="Total users"
          value={fmtNumber(users.total)}
          sub={`${fmtNumber(users.blocked)} blocked · every user is a caller`}
          to="/users"
        />
        <StatCard
          icon={CircleDollarSign}
          label="Net revenue"
          value={fmtMoney(revenue.netRevenue)}
          sub={`${fmtMoney(revenue.grossRevenue)} gross · ${fmtMoney(revenue.refundedAmount)} refunded`}
          tone="emerald"
          to="/payments?status=SUCCESS"
        />
        <StatCard
          icon={Coins}
          label="Tokens sold"
          value={fmtTokens(tokenSales.tokensSold)}
          sub={`+${fmtTokens(tokenSales.bonusTokensGranted)} bonus granted`}
          tone="amber"
        />
        <StatCard
          icon={PhoneCall}
          label="Total calls"
          value={fmtNumber(calls.total)}
          sub={`${fmtDuration(calls.totalDurationSeconds)} talk time`}
          to="/calls"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* SRS 3.13 explicitly requires listener count per language. */}
        <Card
          title="Listeners per language"
          description="Only languages with at least one listener are charted."
          actions={
            <Link to="/languages" className="text-xs font-medium text-brand-600 hover:underline">
              Manage languages
            </Link>
          }
        >
          {languageChart.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-500">
              No approved listeners have selected a language yet.
            </p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={languageChart} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis
                    type="category"
                    dataKey="language"
                    width={86}
                    tick={{ fontSize: 11, fill: '#475569' }}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    formatter={(value) => [`${value} listener(s)`, 'Count']}
                  />
                  <Bar dataKey="listenerCount" radius={[0, 4, 4, 0]} barSize={16}>
                    {languageChart.map((entry) => (
                      // Inactive languages are dimmed: their mappings survive
                      // deactivation, so they still legitimately appear here.
                      <Cell key={entry.languageId} fill={entry.active ? '#6366f1' : '#cbd5e1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {languageChart.some((l) => !l.active) && (
            <p className="mt-3 text-xs text-ink-500">
              Grey bars are deactivated languages. Existing listener mappings are kept, so history
              stays intact.
            </p>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Listener pipeline">
            <dl className="grid grid-cols-2 gap-4">
              {[
                { label: 'Pending', value: listeners.pendingApplications, tone: 'warning' },
                { label: 'Approved', value: listeners.approved, tone: 'success' },
                { label: 'Rejected', value: listeners.rejected, tone: 'neutral' },
                { label: 'Suspended', value: listeners.suspended, tone: 'danger' },
              ].map((item) => (
                <div key={item.label} className="rounded-lg bg-ink-50 px-3.5 py-3">
                  <dt className="flex items-center gap-2 text-xs text-ink-500">
                    <Badge tone={item.tone}>{item.label}</Badge>
                  </dt>
                  <dd className="mt-1.5 text-lg font-semibold tabular text-ink-900">
                    {fmtNumber(item.value)}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card title="Call outcomes" description="Distribution across every recorded call.">
            {Object.keys(calls.byStatus || {}).length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-500">No calls recorded yet.</p>
            ) : (
              <ul className="space-y-2">
                {Object.entries(calls.byStatus)
                  .sort((a, b) => b[1] - a[1])
                  .map(([status, count]) => {
                    const pct = calls.total > 0 ? Math.round((count / calls.total) * 100) : 0;
                    return (
                      <li key={status} className="flex items-center gap-3">
                        <span className="w-24 shrink-0 text-xs text-ink-600">
                          {titleCase(status)}
                        </span>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                          <span
                            className="block h-full rounded-full bg-brand-500"
                            style={{ width: `${pct}%` }}
                          />
                        </span>
                        <span className="w-16 shrink-0 text-right text-xs tabular text-ink-700">
                          {fmtNumber(count)}
                        </span>
                      </li>
                    );
                  })}
              </ul>
            )}
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-ink-100 pt-3.5 text-xs">
              <div>
                <dt className="text-ink-500">Average duration</dt>
                <dd className="mt-0.5 font-medium tabular text-ink-800">
                  {fmtDuration(calls.averageDurationSeconds)}
                </dd>
              </div>
              <div>
                <dt className="text-ink-500">Tokens consumed</dt>
                <dd className="mt-0.5 font-medium tabular text-ink-800">
                  {fmtTokens(calls.totalTokensConsumed)}
                </dd>
              </div>
            </dl>
          </Card>
        </div>

        <Card
          title="Wallet ledger by type"
          description="Net token movement per ledger entry type. Debits are negative."
        >
          {!ledger || ledger.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-500">No ledger entries yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-500">
                  <th className="py-2 text-left font-semibold">Type</th>
                  <th className="py-2 text-right font-semibold">Entries</th>
                  <th className="py-2 text-right font-semibold">Net tokens</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((row) => (
                  <tr key={row.type} className="border-b border-ink-100 last:border-0">
                    <td className="py-2 text-ink-700">{titleCase(row.type)}</td>
                    <td className="py-2 text-right tabular text-ink-600">
                      {fmtNumber(row.entries)}
                    </td>
                    <td
                      className={`py-2 text-right font-medium tabular ${
                        row.netTokens < 0 ? 'text-red-600' : 'text-emerald-700'
                      }`}
                    >
                      {row.netTokens > 0 ? '+' : ''}
                      {fmtTokens(row.netTokens)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Weekly bonus" description="Cumulative across every completed run.">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Runs', value: fmtNumber(weeklyBonus.totalRuns), icon: Clock },
              { label: 'Users rewarded', value: fmtNumber(weeklyBonus.totalUsersRewarded), icon: Users },
              { label: 'Tokens awarded', value: fmtTokens(weeklyBonus.totalTokensAwarded), icon: Coins },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-ink-50 px-3 py-3 text-center">
                <item.icon className="mx-auto mb-1.5 size-4 text-ink-400" />
                <p className="text-lg font-semibold tabular text-ink-900">{item.value}</p>
                <p className="mt-0.5 text-xs text-ink-500">{item.label}</p>
              </div>
            ))}
          </div>
          <Link
            to="/bonuses"
            className="mt-4 block text-center text-xs font-medium text-brand-600 hover:underline"
          >
            View weekly bonus runs
          </Link>
        </Card>
      </div>

      {isFetching && (
        <p className="mt-4 text-center text-xs text-ink-400">Refreshing…</p>
      )}
    </>
  );
}
