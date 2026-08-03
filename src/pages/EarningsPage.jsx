import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Banknote } from 'lucide-react';
import { earningsApi, payoutsApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { useApiMutation } from '../hooks/useApiMutation';
import { useAuth } from '../auth/AuthContext';
import { P } from '../auth/permissions';
import { DataTable, FilterBar, Pagination } from '../components/DataTable';
import {
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  StatusBadge,
  Textarea,
  Toggle,
} from '../components/ui';
import { useTableState } from '../hooks/useTableState';
import { fmtDateTime, fmtDuration, fmtPaise, shortId } from '../lib/format';

function ManualPayoutModal({ listenerUserId, onClose }) {
  const [notes, setNotes] = useState('');
  const [processImmediately, setProcessImmediately] = useState(true);

  const summary = useQuery({
    queryKey: qk.earningsSummary({ listenerUserId }),
    queryFn: () => earningsApi.summary({ listenerUserId }),
    enabled: Boolean(listenerUserId),
  });

  const pendingPaise = summary.data?.pendingAmountPaise || 0;

  const mutation = useApiMutation({
    mutationFn: () =>
      payoutsApi.create({
        listenerUserId,
        notes: notes.trim() || undefined,
        processImmediately,
      }),
    successMessage: 'Manual payout created',
    invalidate: [['payouts'], ['earnings']],
    onSuccess: onClose,
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Manual payout"
      description="Bundles all pending earnings for this listener."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={pendingPaise <= 0 || summary.isLoading}
          >
            Create payout
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {mutation.error && <ErrorState error={mutation.error} compact />}
        <div className="rounded-lg bg-ink-50 px-3.5 py-3 text-sm">
          <p className="text-xs uppercase tracking-wide text-ink-500">Pending to pay</p>
          <p className="mt-1 text-lg font-semibold text-ink-900">
            {summary.isLoading ? '…' : fmtPaise(pendingPaise)}
          </p>
          <p className="font-mono text-xs text-ink-500">{listenerUserId}</p>
        </div>
        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </Field>
        <Toggle
          checked={processImmediately}
          onChange={setProcessImmediately}
          label="Process via Cashfree immediately"
        />
      </div>
    </Modal>
  );
}

export function EarningsPage() {
  const { can } = useAuth();
  const canWrite = can(P.PAYOUTS_WRITE);
  const [payoutListenerId, setPayoutListenerId] = useState(null);

  const table = useTableState({
    status: '',
    listenerUserId: '',
    from: '',
    to: '',
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.earnings(table.params),
    queryFn: () => earningsApi.list(table.params),
  });

  const summary = useQuery({
    queryKey: qk.earningsSummary({ listenerUserId: table.filters.listenerUserId || undefined }),
    queryFn: () =>
      earningsApi.summary({
        listenerUserId: table.filters.listenerUserId || undefined,
      }),
  });

  const columns = [
    {
      key: 'listener',
      header: 'Listener',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink-900">
            {row.listener?.listenerApplication?.displayName ||
              row.listener?.name ||
              shortId(row.listenerUserId)}
          </p>
          <p className="font-mono text-[11px] text-ink-500">{shortId(row.listenerUserId)}</p>
        </div>
      ),
    },
    {
      key: 'call',
      header: 'Call',
      render: (row) => (
        <Link
          to={`/calls/${row.callSessionId}`}
          className="font-mono text-xs text-brand-700 hover:underline"
        >
          {shortId(row.callSessionId)}
        </Link>
      ),
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (row) => fmtDuration(row.durationSeconds),
    },
    {
      key: 'rate',
      header: 'Rate',
      render: (row) => `${row.earnPaisePerSecond} paise/s`,
    },
    {
      key: 'amount',
      header: 'Earned',
      align: 'right',
      render: (row) => (
        <span className="font-medium text-ink-900">{fmtPaise(row.amountPaise)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'when',
      header: 'Accrued',
      render: (row) => (
        <span className="text-xs text-ink-600">{fmtDateTime(row.createdAt)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Listener earnings"
        description="Per-call INR accruals after the listener picks up. Caller token billing is unchanged — this is what listeners are owed before payout."
        actions={
          canWrite && table.filters.listenerUserId.trim() ? (
            <Button onClick={() => setPayoutListenerId(table.filters.listenerUserId.trim())}>
              <Banknote className="size-4" />
              Manual payout
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Pending', key: 'PENDING' },
          { label: 'In a payout', key: 'IN_PAYOUT' },
          { label: 'Paid', key: 'PAID' },
        ].map((card) => (
          <Card key={card.key} className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{card.label}</p>
            <p className="mt-1 text-xl font-semibold text-ink-900">
              {fmtPaise(summary.data?.byStatus?.[card.key]?.amountPaise || 0)}
            </p>
            <p className="text-xs text-ink-500">
              {summary.data?.byStatus?.[card.key]?.count || 0} rows
            </p>
          </Card>
        ))}
      </div>

      <Card>
        <FilterBar>
          <Field label="Status">
            <Select
              value={table.filters.status}
              onChange={(e) => table.setFilter('status', e.target.value)}
            >
              <option value="">All</option>
              <option value="PENDING">PENDING</option>
              <option value="IN_PAYOUT">IN_PAYOUT</option>
              <option value="PAID">PAID</option>
              <option value="VOID">VOID</option>
            </Select>
          </Field>
          <Field label="Listener user id">
            <Input
              value={table.filters.listenerUserId}
              onChange={(e) => table.setFilter('listenerUserId', e.target.value)}
              placeholder="UUID"
              className="font-mono text-xs"
            />
          </Field>
          <Field label="From">
            <Input
              type="date"
              value={table.filters.from}
              onChange={(e) => table.setFilter('from', e.target.value)}
            />
          </Field>
          <Field label="To">
            <Input
              type="date"
              value={table.filters.to}
              onChange={(e) => table.setFilter('to', e.target.value)}
            />
          </Field>
        </FilterBar>

        <DataTable
          columns={columns}
          rows={data?.data || []}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          emptyTitle="No earnings yet"
          emptyDescription="Earnings appear after a call with positive duration settles, using the listener earn rate from Configuration."
        />
        <Pagination meta={data?.meta} page={table.page} onPageChange={table.setPage} />
      </Card>

      {payoutListenerId && (
        <ManualPayoutModal
          listenerUserId={payoutListenerId}
          onClose={() => setPayoutListenerId(null)}
        />
      )}
    </div>
  );
}
