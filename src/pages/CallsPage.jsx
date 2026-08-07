import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download, PhoneCall } from 'lucide-react';
import { callsApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { DataTable, FilterBar, Pagination } from '../components/DataTable';
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  SearchInput,
  Select,
  StatusBadge,
} from '../components/ui';
import { useToast } from '../components/ui/Toast';
import { useTableState } from '../hooks/useTableState';
import { fmtDateTime, fmtDuration, fmtTokens, shortId } from '../lib/format';

const CALL_STATUSES = [
  'RINGING',
  'ACTIVE',
  'ENDED',
  'MISSED',
  'REJECTED',
  'CANCELLED',
  'TERMINATED',
  'FAILED',
];

export function CallsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();

  const table = useTableState({
    status: searchParams.get('status') || '',
    search: '',
    callerId: '',
    listenerId: '',
    from: '',
    to: '',
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.calls(table.params),
    queryFn: () => callsApi.list(table.params),
    // In-progress calls change second to second.
    refetchInterval: table.filters.status === 'ACTIVE' ? 10_000 : false,
  });

  console.log('Calls API response:', data);
  console.log('Calls rows:', data?.data);
console.log('Calls rows length:', data?.data?.length);

  const exportCsv = async () => {
    try {
      await callsApi.downloadReport({ from: table.filters.from, to: table.filters.to });
      toast.success('Call report downloaded');
    } catch (err) {
      toast.error(err);
    }
  };

  const columns = [
    {
      key: 'participants',
      header: 'Participants',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-ink-900">
            {row.caller?.name || shortId(row.callerId)}
            <span className="mx-1.5 text-ink-400">→</span>
            {row.listener?.displayName || row.listener?.name || shortId(row.listenerId)}
          </p>
          <p className="truncate font-mono text-[11px] text-ink-500">{row.channelName}</p>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'duration',
      header: 'Duration',
      align: 'right',
      render: (row) => fmtDuration(row.durationSeconds),
    },
    {
      key: 'tokens',
      header: 'Tokens',
      align: 'right',
      render: (row) => (
        <span className="font-medium text-ink-800">{fmtTokens(row.tokensConsumed)}</span>
      ),
    },
    {
      key: 'rate',
      header: 'Rate',
      align: 'right',
      render: (row) => <span className="text-xs text-ink-600">{row.ratePerSecond}/s</span>,
    },
    {
      key: 'endReason',
      header: 'End reason',
      render: (row) =>
        row.endReason ? (
          <Badge
            tone={
              row.endReason === 'INSUFFICIENT_BALANCE' || String(row.endReason).includes('NETWORK')
                ? 'warning'
                : 'neutral'
            }
          >
            {row.endReason.replace(/_/g, ' ').toLowerCase()}
          </Badge>
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
    {
      key: 'initiatedAt',
      header: 'Started',
      render: (row) => (
        <span className="text-xs text-ink-600">{fmtDateTime(row.initiatedAt)}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Calls"
        description="Every call session. Billing is elapsed seconds × the rate snapshotted at initiate, settled once when the call ends."
        actions={
          <Button variant="secondary" onClick={exportCsv}>
            <Download className="size-4" />
            Export CSV
          </Button>
        }
      />

      <Card bodyClassName="">
        <FilterBar onReset={table.isFiltered ? table.reset : undefined}>
          <Field label="Search" className="w-full sm:w-52">
            <SearchInput
              value={table.filters.search}
              onChange={(v) => table.setFilter('search', v)}
              placeholder="Channel or session id"
            />
          </Field>

          <Field label="Status" className="w-40">
            <Select
              value={table.filters.status}
              onChange={(e) => table.setFilter('status', e.target.value)}
            >
              <option value="">All</option>
              {CALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.toLowerCase()}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Caller id" className="w-40">
            <SearchInput
              value={table.filters.callerId}
              onChange={(v) => table.setFilter('callerId', v)}
              placeholder="UUID"
            />
          </Field>

          <Field label="Listener id" className="w-40">
            <SearchInput
              value={table.filters.listenerId}
              onChange={(v) => table.setFilter('listenerId', v)}
              placeholder="UUID"
            />
          </Field>

          <Field label="From" className="w-36">
            <Input
              type="date"
              value={table.filters.from}
              onChange={(e) => table.setFilter('from', e.target.value)}
            />
          </Field>
          <Field label="To" className="w-36">
            <Input
              type="date"
              value={table.filters.to}
              onChange={(e) => table.setFilter('to', e.target.value)}
            />
          </Field>
        </FilterBar>

        <DataTable
          columns={columns}
          rows={data?.data}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          onRowClick={(row) => 
            navigate(`/calls/${row.callSessionId}`)}
          emptyIcon={PhoneCall}
          emptyTitle="No calls match these filters"
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
