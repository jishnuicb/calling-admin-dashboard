import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Download, IndianRupee } from 'lucide-react';
import { referralsApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { DataTable, FilterBar, Pagination } from '../components/DataTable';
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  Tabs,
} from '../components/ui';
import { useToast } from '../components/ui/Toast';
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

function ExportButton({ onExport, busy }) {
  return (
    <Button variant="secondary" size="sm" loading={busy} onClick={onExport}>
      <Download className="size-4" />
      Export CSV
    </Button>
  );
}

/** All incentive lines (referral-sourced today; sourceType filter for future kinds). */
export function IncentivesPage() {
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const table = useTableState(
    {
      sourceType: 'REFERRAL',
      status: '',
      weekStart: '',
      search: '',
      referrerListenerUserId: '',
    },
    { limit: 20 },
  );

  const params = {
    ...table.params,
    sourceType: table.filters.sourceType || undefined,
    status: table.filters.status || undefined,
    weekStart: table.filters.weekStart || undefined,
    search: table.filters.search || undefined,
    referrerListenerUserId: table.filters.referrerListenerUserId || undefined,
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.incentives(params),
    queryFn: () => referralsApi.incentives(params),
  });

  const columns = [
    {
      key: 'sourceType',
      header: 'Type',
      render: (row) => <Badge tone="brand">{row.sourceType || 'REFERRAL'}</Badge>,
    },
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
      key: 'listener',
      header: 'Listener',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink-900">
            {personLabel(row.referrer, row.listenerUserId)}
          </p>
          <p className="font-mono text-[11px] text-ink-500">{shortId(row.listenerUserId)}</p>
        </div>
      ),
    },
    {
      key: 'referred',
      header: 'Linked referred',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-ink-800">
            {personLabel(row.referred, row.referredUserId)}
          </p>
          <p className="font-mono text-[11px] text-ink-400">ref {shortId(row.referralId)}</p>
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
      header: 'Weekly ₹',
      align: 'right',
      render: (row) => (
        <span className="font-medium text-emerald-700">₹{fmtNumber(row.amountRupees)}</span>
      ),
    },
    {
      key: 'bonus',
      header: 'Ref. bonus ₹',
      align: 'right',
      render: (row) => `₹${fmtNumber(row.referralBonusRupees)}`,
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-ink-600">{fmtDateTime(row.createdAt)}</span>
      ),
    },
  ];

  const onExport = async () => {
    setExporting(true);
    try {
      await referralsApi.exportIncentives(params);
      toast.success('Incentives CSV downloaded');
    } catch (err) {
      toast.error(err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Incentive"
        description="Listener incentives linked to referrals today. New incentive types can appear here with a different Type without changing this layout."
        actions={<ExportButton onExport={onExport} busy={exporting} />}
      />

      <Card bodyClassName="">
        <FilterBar>
          <Field label="Type" className="w-40">
            <Select
              value={table.filters.sourceType}
              onChange={(e) => table.setFilter('sourceType', e.target.value)}
            >
              <option value="REFERRAL">REFERRAL</option>
            </Select>
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
          <Field label="Week start" className="w-44">
            <Input
              type="date"
              value={table.filters.weekStart}
              onChange={(e) => table.setFilter('weekStart', e.target.value)}
            />
          </Field>
          <Field label="Search" className="w-48">
            <Input
              value={table.filters.search}
              placeholder="Name or publicId…"
              onChange={(e) => table.setFilter('search', e.target.value)}
            />
          </Field>
          <Field label="Listener user ID" className="w-52">
            <Input
              value={table.filters.referrerListenerUserId}
              placeholder="UUID"
              onChange={(e) => table.setFilter('referrerListenerUserId', e.target.value)}
            />
          </Field>
        </FilterBar>

        <DataTable
          columns={columns}
          rows={data?.data}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          emptyIcon={IndianRupee}
          emptyTitle="No incentives"
          emptyDescription="Create a referral with incentive weeks to see rows here."
        />
        <Pagination
          meta={data?.meta}
          onPageChange={table.setPage}
          onLimitChange={table.changeLimit}
        />
      </Card>
    </>
  );
}

/** One IST week board of incentives (referral-backed). */
export function WeeklyIncentivesPage() {
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
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
      key: 'type',
      header: 'Type',
      render: () => <Badge tone="brand">REFERRAL</Badge>,
    },
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
      header: 'Listener',
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
        <p className="truncate text-sm text-ink-800">
          {personLabel(row.referred, row.referredUserId)}
        </p>
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

  const onExport = async () => {
    setExporting(true);
    try {
      await referralsApi.exportWeeklyIncentiveReport(params);
      toast.success('Weekly incentive CSV downloaded');
    } catch (err) {
      toast.error(err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Weekly Incentive"
        description="Incentives for one IST Mon–Sun week. These amounts feed Weekly bank payouts when ACTIVE."
        actions={<ExportButton onExport={onExport} busy={exporting} />}
      />

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
          <Field label="Listener user ID" className="w-52">
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
          emptyDescription="Pick a week or create referral incentive weeks first."
        />
        <Pagination
          meta={data?.meta}
          onPageChange={table.setPage}
          onLimitChange={table.changeLimit}
        />
      </Card>
    </>
  );
}

/** Incentive reports with export (all lines + weekly). */
export function IncentiveReportsPage() {
  const toast = useToast();
  const [tab, setTab] = useState('all');
  const [exporting, setExporting] = useState(false);

  const allTable = useTableState(
    { sourceType: 'REFERRAL', status: '', weekStart: '', search: '', referrerListenerUserId: '' },
    { limit: 20 },
  );
  const weekTable = useTableState(
    { weekStart: '', status: '', search: '', referrerListenerUserId: '' },
    { limit: 20 },
  );

  const allParams = {
    ...allTable.params,
    sourceType: allTable.filters.sourceType || undefined,
    status: allTable.filters.status || undefined,
    weekStart: allTable.filters.weekStart || undefined,
    search: allTable.filters.search || undefined,
    referrerListenerUserId: allTable.filters.referrerListenerUserId || undefined,
  };
  const weekParams = {
    ...weekTable.params,
    weekStart: weekTable.filters.weekStart || undefined,
    status: weekTable.filters.status || undefined,
    search: weekTable.filters.search || undefined,
    referrerListenerUserId: weekTable.filters.referrerListenerUserId || undefined,
  };

  const allQuery = useQuery({
    queryKey: qk.incentives(allParams),
    queryFn: () => referralsApi.incentives(allParams),
    enabled: tab === 'all',
  });
  const weekQuery = useQuery({
    queryKey: qk.weeklyIncentiveReport(weekParams),
    queryFn: () => referralsApi.weeklyIncentiveReport(weekParams),
    enabled: tab === 'weekly',
  });

  const onExport = async () => {
    setExporting(true);
    try {
      if (tab === 'all') {
        await referralsApi.exportIncentives(allParams);
        toast.success('Incentive report CSV downloaded');
      } else {
        await referralsApi.exportWeeklyIncentiveReport(weekParams);
        toast.success('Weekly incentive report CSV downloaded');
      }
    } catch (err) {
      toast.error(err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Incentive Report"
        description="Exportable incentive reports. Referral incentives are included as Type REFERRAL."
        actions={<ExportButton onExport={onExport} busy={exporting} />}
      />
      <Tabs
        tabs={[
          { id: 'all', label: 'All incentives' },
          { id: 'weekly', label: 'Weekly incentives' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'all' && (
        <Card bodyClassName="">
          <FilterBar>
            <Field label="Type" className="w-40">
              <Select
                value={allTable.filters.sourceType}
                onChange={(e) => allTable.setFilter('sourceType', e.target.value)}
              >
                <option value="REFERRAL">REFERRAL</option>
              </Select>
            </Field>
            <Field label="Status" className="w-36">
              <Select
                value={allTable.filters.status}
                onChange={(e) => allTable.setFilter('status', e.target.value)}
              >
                <option value="">All</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="STOPPED">STOPPED</option>
              </Select>
            </Field>
            <Field label="Week start" className="w-44">
              <Input
                type="date"
                value={allTable.filters.weekStart}
                onChange={(e) => allTable.setFilter('weekStart', e.target.value)}
              />
            </Field>
            <Field label="Search" className="w-48">
              <Input
                value={allTable.filters.search}
                onChange={(e) => allTable.setFilter('search', e.target.value)}
              />
            </Field>
          </FilterBar>
          <DataTable
            columns={[
              {
                key: 'sourceType',
                header: 'Type',
                render: (row) => <Badge tone="brand">{row.sourceType}</Badge>,
              },
              {
                key: 'week',
                header: 'Week',
                render: (row) => (
                  <span className="font-mono text-xs">
                    {row.weekStartDate} → {row.weekEndDate}
                  </span>
                ),
              },
              {
                key: 'listener',
                header: 'Listener',
                render: (row) => personLabel(row.referrer, row.listenerUserId),
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
                render: (row) => `₹${fmtNumber(row.amountRupees)}`,
              },
            ]}
            rows={allQuery.data?.data}
            loading={allQuery.isLoading}
            error={allQuery.error}
            onRetry={allQuery.refetch}
            emptyIcon={ClipboardList}
            emptyTitle="No incentive rows"
          />
          <Pagination
            meta={allQuery.data?.meta}
            onPageChange={allTable.setPage}
            onLimitChange={allTable.changeLimit}
          />
        </Card>
      )}

      {tab === 'weekly' && (
        <Card bodyClassName="">
          <FilterBar>
            <Field label="Week start" className="w-44">
              <Input
                type="date"
                value={weekTable.filters.weekStart}
                onChange={(e) => weekTable.setFilter('weekStart', e.target.value)}
              />
            </Field>
            <Field label="Status" className="w-36">
              <Select
                value={weekTable.filters.status}
                onChange={(e) => weekTable.setFilter('status', e.target.value)}
              >
                <option value="">All</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="STOPPED">STOPPED</option>
              </Select>
            </Field>
            <Field label="Search" className="w-48">
              <Input
                value={weekTable.filters.search}
                onChange={(e) => weekTable.setFilter('search', e.target.value)}
              />
            </Field>
          </FilterBar>
          <DataTable
            columns={[
              {
                key: 'week',
                header: 'Week',
                render: (row) => (
                  <span className="font-mono text-xs">
                    {row.weekStartDate} → {row.weekEndDate}
                  </span>
                ),
              },
              {
                key: 'listener',
                header: 'Listener',
                render: (row) => personLabel(row.referrer, row.referrerListenerUserId),
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
                render: (row) => `₹${fmtNumber(row.amountRupees)}`,
              },
            ]}
            rows={weekQuery.data?.data}
            loading={weekQuery.isLoading}
            error={weekQuery.error}
            onRetry={weekQuery.refetch}
            emptyIcon={ClipboardList}
            emptyTitle="No weekly rows"
          />
          <Pagination
            meta={weekQuery.data?.meta}
            onPageChange={weekTable.setPage}
            onLimitChange={weekTable.changeLimit}
          />
        </Card>
      )}
    </>
  );
}
