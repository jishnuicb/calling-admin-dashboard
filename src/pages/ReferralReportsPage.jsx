import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Download } from 'lucide-react';
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

export function ReferralReportsPage() {
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
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

  const onExport = async () => {
    setExporting(true);
    try {
      await referralsApi.exportReferralReport(params);
      toast.success('Referral report CSV downloaded');
    } catch (err) {
      toast.error(err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Referral Report"
        description="Referral roll-ups. Weekly incentive detail lives under Incentives → Report / Weekly Incentive."
        actions={
          <Button variant="secondary" size="sm" loading={exporting} onClick={onExport}>
            <Download className="size-4" />
            Export CSV
          </Button>
        }
      />

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
    </>
  );
}
