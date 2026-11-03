import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { referralsApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { DataTable, FilterBar, Pagination } from '../components/DataTable';
import {
  Badge,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  Tabs,
} from '../components/ui';
import { useTableState } from '../hooks/useTableState';
import { fmtDateTime, fmtNumber, shortId } from '../lib/format';

function personLabel(person, fallbackId) {
  if (!person) return shortId(fallbackId);
  const name = person.displayName || person.name;
  if (name && person.publicId) return `${name} · ${person.publicId}`;
  if (name) return name;
  if (person.publicId) return person.publicId;
  return shortId(person.id || fallbackId);
}

function StatusToneBadge({ status }) {
  const tone = status === 'ACTIVE' ? 'success' : status === 'STOPPED' ? 'danger' : 'neutral';
  return <Badge tone={tone}>{status || '—'}</Badge>;
}

function ReferralReportTab() {
  const table = useTableState(
    {
      status: '',
      search: '',
      referrerListenerUserId: '',
      from: '',
      to: '',
    },
    { limit: 20 },
  );

  const params = {
    ...table.params,
    status: table.filters.status || undefined,
    search: table.filters.search || undefined,
    referrerListenerUserId: table.filters.referrerListenerUserId || undefined,
    from: table.filters.from || undefined,
    to: table.filters.to || undefined,
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.referralReport(params),
    queryFn: () => referralsApi.referralReport(params),
  });

  const totals = data?.totals;

  const columns = [
    {
      key: 'referrer',
      header: 'Referrer',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink-900">
            {personLabel(row.referrer, row.referrerListenerUserId)}
          </p>
          <p className="font-mono text-[11px] text-ink-500">{shortId(row.referrerListenerUserId)}</p>
        </div>
      ),
    },
    {
      key: 'referred',
      header: 'Referred',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-ink-800">
            {personLabel(row.referred, row.referredUserId)}
          </p>
          <p className="font-mono text-[11px] text-ink-500">{shortId(row.referredUserId)}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusToneBadge status={row.status} />,
    },
    {
      key: 'eligible',
      header: 'Incentive',
      render: (row) => (
        <Badge tone={row.incentiveEligible ? 'info' : 'neutral'}>
          {row.incentiveEligible ? 'Eligible' : 'No'}
        </Badge>
      ),
    },
    {
      key: 'bonus',
      header: 'Bonus ₹',
      align: 'right',
      render: (row) => `₹${fmtNumber(row.referralBonusRupees)}`,
    },
    {
      key: 'activeWeeks',
      header: 'Active weeks',
      render: (row) => (
        <span className="font-mono text-xs text-ink-700">
          {(row.activeWeekStarts || []).join(', ') || '—'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-ink-600">{fmtDateTime(row.createdAt)}</span>
      ),
    },
  ];

  return (
    <Card bodyClassName="">
      <FilterBar>
        <Field label="Search" className="w-48">
          <Input
            value={table.filters.search}
            placeholder="Name or publicId…"
            onChange={(e) => table.setFilter('search', e.target.value)}
          />
        </Field>
        <Field label="Status" className="w-36">
          <Select
            value={table.filters.status}
            onChange={(e) => table.setFilter('status', e.target.value)}
          >
            <option value="">All</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="STOPPED">STOPPED</option>
          </Select>
        </Field>
        <Field label="Referrer user ID" className="w-52">
          <Input
            value={table.filters.referrerListenerUserId}
            placeholder="UUID"
            onChange={(e) => table.setFilter('referrerListenerUserId', e.target.value)}
          />
        </Field>
        <Field label="From" className="w-40">
          <Input
            type="date"
            value={table.filters.from}
            onChange={(e) => table.setFilter('from', e.target.value)}
          />
        </Field>
        <Field label="To" className="w-40">
          <Input
            type="date"
            value={table.filters.to}
            onChange={(e) => table.setFilter('to', e.target.value)}
          />
        </Field>
      </FilterBar>

      {totals && (
        <div className="grid grid-cols-2 gap-3 border-b border-ink-100 px-5 py-3 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs text-ink-500">Referrals</p>
            <p className="font-medium">{fmtNumber(totals.referrals)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-500">Active</p>
            <p className="font-medium">{fmtNumber(totals.active)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-500">Stopped</p>
            <p className="font-medium">{fmtNumber(totals.stopped)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-500">Incentive eligible</p>
            <p className="font-medium">{fmtNumber(totals.incentiveEligible)}</p>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={data?.data}
        loading={isLoading}
        error={error}
        onRetry={refetch}
        emptyIcon={ClipboardList}
        emptyTitle="No referral rows"
        emptyDescription="Adjust filters or create referrals first."
      />
      <Pagination
        meta={data?.meta}
        onPageChange={table.setPage}
        onLimitChange={table.changeLimit}
      />
    </Card>
  );
}

function WeeklyIncentivesTab() {
  const table = useTableState(
    {
      weekStart: '',
      status: '',
      search: '',
      referrerListenerUserId: '',
    },
    { limit: 20 },
  );

  const params = {
    ...table.params,
    weekStart: table.filters.weekStart || undefined,
    status: table.filters.status || undefined,
    search: table.filters.search || undefined,
    referrerListenerUserId: table.filters.referrerListenerUserId || undefined,
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.weeklyIncentiveReport(params),
    queryFn: () => referralsApi.weeklyIncentiveReport(params),
  });

  const summary = data?.summary;
  const week = data?.week;

  const columns = [
    {
      key: 'week',
      header: 'Week',
      render: (row) => (
        <span className="font-mono text-xs text-ink-800">
          {row.weekStartDate} → {row.weekEndDate}
        </span>
      ),
    },
    {
      key: 'referrer',
      header: 'Referrer',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink-900">
            {personLabel(row.referrer, row.referrerListenerUserId)}
          </p>
          <p className="font-mono text-[11px] text-ink-500">{shortId(row.referrerListenerUserId)}</p>
        </div>
      ),
    },
    {
      key: 'referred',
      header: 'Referred',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-ink-800">
            {personLabel(row.referred, row.referredUserId)}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusToneBadge status={row.status} />,
    },
    {
      key: 'amount',
      header: 'Amount ₹',
      align: 'right',
      render: (row) => (
        <span className="font-medium text-emerald-700">₹{fmtNumber(row.amountRupees)}</span>
      ),
    },
    {
      key: 'referralBonus',
      header: 'Ref. bonus ₹',
      align: 'right',
      render: (row) => `₹${fmtNumber(row.referralBonusRupees)}`,
    },
  ];

  return (
    <Card bodyClassName="">
      <FilterBar>
        <Field label="Week start (IST Monday)" className="w-44">
          <Input
            type="date"
            value={table.filters.weekStart}
            onChange={(e) => table.setFilter('weekStart', e.target.value)}
          />
        </Field>
        <Field label="Status" className="w-36">
          <Select
            value={table.filters.status}
            onChange={(e) => table.setFilter('status', e.target.value)}
          >
            <option value="">All</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="STOPPED">STOPPED</option>
          </Select>
        </Field>
        <Field label="Search" className="w-48">
          <Input
            value={table.filters.search}
            placeholder="Name or publicId…"
            onChange={(e) => table.setFilter('search', e.target.value)}
          />
        </Field>
        <Field label="Referrer user ID" className="w-52">
          <Input
            value={table.filters.referrerListenerUserId}
            placeholder="UUID"
            onChange={(e) => table.setFilter('referrerListenerUserId', e.target.value)}
          />
        </Field>
      </FilterBar>

      {(summary || week) && (
        <div className="grid grid-cols-2 gap-3 border-b border-ink-100 px-5 py-3 text-sm sm:grid-cols-4">
          {week && (
            <div>
              <p className="text-xs text-ink-500">Week</p>
              <p className="font-mono text-sm font-medium">
                {week.weekStartDate} → {week.weekEndDate}
              </p>
            </div>
          )}
          {summary && (
            <>
              <div>
                <p className="text-xs text-ink-500">Rows</p>
                <p className="font-medium">{fmtNumber(summary.rows)}</p>
              </div>
              <div>
                <p className="text-xs text-ink-500">Listeners</p>
                <p className="font-medium">{fmtNumber(summary.listeners)}</p>
              </div>
              <div>
                <p className="text-xs text-ink-500">Total incentive</p>
                <p className="font-semibold">
                  ₹{fmtNumber(summary.totalIncentiveAmountRupees)}
                </p>
              </div>
            </>
          )}
        </div>
      )}

      <DataTable
        columns={columns}
        rows={data?.data}
        loading={isLoading}
        error={error}
        onRetry={refetch}
        emptyIcon={ClipboardList}
        emptyTitle="No weekly incentives"
        emptyDescription="Pick a week start or wait until incentive weeks exist."
      />
      <Pagination
        meta={data?.meta}
        onPageChange={table.setPage}
        onLimitChange={table.changeLimit}
      />
    </Card>
  );
}

export function ReferralReportsPage() {
  const [tab, setTab] = useState('referrals');

  return (
    <>
      <PageHeader
        title="Referral Report"
        description="Referral roll-ups and weekly incentive totals for listener referrals."
      />
      <Tabs
        tabs={[
          { id: 'referrals', label: 'Referral report' },
          { id: 'weekly', label: 'Weekly incentives' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'referrals' ? <ReferralReportTab /> : <WeeklyIncentivesTab />}
    </>
  );
}
