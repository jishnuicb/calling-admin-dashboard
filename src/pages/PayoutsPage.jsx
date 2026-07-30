import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { payoutsApi } from '../api/endpoints';
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
import { fmtDateTime, fmtPaise, shortId } from '../lib/format';

function CreatePayoutModal({ open, onClose }) {
  const [listenerUserId, setListenerUserId] = useState('');
  const [notes, setNotes] = useState('');
  const [processImmediately, setProcessImmediately] = useState(true);

  const mutation = useApiMutation({
    mutationFn: () =>
      payoutsApi.create({
        listenerUserId: listenerUserId.trim(),
        notes: notes.trim() || undefined,
        processImmediately,
      }),
    successMessage: 'Payout created',
    invalidate: [['payouts'], ['earnings']],
    onSuccess: onClose,
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create manual payout"
      description="Bundles all pending earnings for one listener. With process on, Cashfree (or dry-run) runs immediately."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!listenerUserId.trim()}
          >
            Create payout
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {mutation.error && <ErrorState error={mutation.error} compact />}
        <Field label="Listener user id" required>
          <Input
            autoFocus
            className="font-mono text-xs"
            value={listenerUserId}
            onChange={(e) => setListenerUserId(e.target.value)}
            placeholder="UUID of the listener's user account"
          />
        </Field>
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

function PayoutDetailModal({ payoutId, onClose }) {
  const canWrite = useAuth().can(P.PAYOUTS_WRITE);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.payout(payoutId),
    queryFn: () => payoutsApi.get(payoutId),
    enabled: Boolean(payoutId),
  });

  const process = useApiMutation({
    mutationFn: () => payoutsApi.process(payoutId),
    successMessage: 'Payout processed',
    invalidate: [qk.payout(payoutId), ['payouts'], ['earnings']],
  });
  const markPaid = useApiMutation({
    mutationFn: () => payoutsApi.markPaid(payoutId, { notes: 'Marked paid offline' }),
    successMessage: 'Marked paid offline',
    invalidate: [qk.payout(payoutId), ['payouts'], ['earnings']],
  });
  const cancel = useApiMutation({
    mutationFn: () => payoutsApi.cancel(payoutId),
    successMessage: 'Payout cancelled',
    invalidate: [qk.payout(payoutId), ['payouts'], ['earnings']],
    onSuccess: onClose,
  });

  return (
    <Modal
      open={Boolean(payoutId)}
      onClose={onClose}
      title={data ? `Payout ${shortId(data.id)}` : 'Payout'}
      description={data ? `${fmtPaise(data.amountPaise)} · ${data.schedule}` : undefined}
      size="lg"
      footer={
        canWrite && data ? (
          <>
            {['PENDING', 'FAILED'].includes(data.status) && (
              <>
                <Button variant="secondary" onClick={() => cancel.mutate()} loading={cancel.isPending}>
                  Cancel
                </Button>
                <Button variant="secondary" onClick={() => markPaid.mutate()} loading={markPaid.isPending}>
                  Mark paid offline
                </Button>
                <Button onClick={() => process.mutate()} loading={process.isPending}>
                  Process via Cashfree
                </Button>
              </>
            )}
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      {isLoading && <p className="text-sm text-ink-500">Loading…</p>}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-ink-500">Status</p>
              <StatusBadge status={data.status} />
            </div>
            <div>
              <p className="text-xs text-ink-500">Transfer id</p>
              <p className="font-mono text-xs">{data.transferId}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">UTR / reference</p>
              <p className="font-mono text-xs">{data.cfUtr || data.cfReferenceId || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Offline</p>
              <p>{data.paidOffline ? 'Yes' : 'No'}</p>
            </div>
            {data.failureReason && (
              <div className="col-span-2">
                <p className="text-xs text-ink-500">Failure</p>
                <p className="text-amber-700">{data.failureReason}</p>
              </div>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-ink-500">
              Earnings ({data.earnings?.length || 0})
            </p>
            <ul className="max-h-56 space-y-1 overflow-y-auto text-xs">
              {(data.earnings || []).map((e) => (
                <li key={e.id} className="flex justify-between gap-2 rounded bg-ink-50 px-2 py-1.5">
                  <Link to={`/calls/${e.callSessionId}`} className="font-mono text-brand-700 hover:underline">
                    {shortId(e.callSessionId)}
                  </Link>
                  <span>{fmtDurationSafe(e.durationSeconds)}</span>
                  <span className="font-medium">{fmtPaise(e.amountPaise)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Modal>
  );
}

function fmtDurationSafe(seconds) {
  const s = Math.max(0, Math.trunc(seconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m ? `${m}m ${r}s` : `${r}s`;
}

export function PayoutsPage() {
  const { can } = useAuth();
  const canWrite = can(P.PAYOUTS_WRITE);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);

  const table = useTableState({
    status: '',
    schedule: '',
    listenerUserId: '',
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.payouts(table.params),
    queryFn: () => payoutsApi.list(table.params),
  });

  const runWeekly = useApiMutation({
    mutationFn: () => payoutsApi.runSchedule({ schedule: 'WEEKLY' }),
    successMessage: 'Weekly payout run finished',
    invalidate: [['payouts'], ['earnings']],
  });
  const runMonthly = useApiMutation({
    mutationFn: () => payoutsApi.runSchedule({ schedule: 'MONTHLY' }),
    successMessage: 'Monthly payout run finished',
    invalidate: [['payouts'], ['earnings']],
  });

  const columns = [
    {
      key: 'id',
      header: 'Payout',
      render: (row) => (
        <button
          type="button"
          onClick={() => setDetailId(row.id)}
          className="font-mono text-xs font-medium text-brand-700 hover:underline"
        >
          {shortId(row.id)}
        </button>
      ),
    },
    {
      key: 'listener',
      header: 'Listener',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {row.listener?.listenerApplication?.displayName ||
              row.listener?.name ||
              shortId(row.listenerUserId)}
          </p>
          <Link
            to={`/listeners?search=${row.listenerUserId}`}
            className="font-mono text-[11px] text-ink-500 hover:underline"
          >
            {shortId(row.listenerUserId)}
          </Link>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (row) => <span className="font-medium">{fmtPaise(row.amountPaise)}</span>,
    },
    {
      key: 'schedule',
      header: 'Schedule',
      render: (row) => row.schedule,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'earnings',
      header: 'Calls',
      align: 'right',
      render: (row) => row.earningsCount ?? '—',
    },
    {
      key: 'when',
      header: 'Created',
      render: (row) => <span className="text-xs text-ink-600">{fmtDateTime(row.createdAt)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Listener payouts"
        description="Pay accrued earnings to listeners via Cashfree Payouts, or mark paid offline. Packages and caller wallets are unaffected."
        actions={
          canWrite ? (
            <>
              <Button
                variant="secondary"
                onClick={() => runWeekly.mutate()}
                loading={runWeekly.isPending}
              >
                Run weekly now
              </Button>
              <Button
                variant="secondary"
                onClick={() => runMonthly.mutate()}
                loading={runMonthly.isPending}
              >
                Run monthly now
              </Button>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                Manual payout
              </Button>
            </>
          ) : null
        }
      />

      <Card>
        <FilterBar>
          <Field label="Status">
            <Select
              value={table.filters.status}
              onChange={(e) => table.setFilter('status', e.target.value)}
            >
              <option value="">All</option>
              {['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'CANCELLED'].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Schedule">
            <Select
              value={table.filters.schedule}
              onChange={(e) => table.setFilter('schedule', e.target.value)}
            >
              <option value="">All</option>
              <option value="MANUAL">MANUAL</option>
              <option value="WEEKLY">WEEKLY</option>
              <option value="MONTHLY">MONTHLY</option>
            </Select>
          </Field>
          <Field label="Listener user id">
            <Input
              className="font-mono text-xs"
              value={table.filters.listenerUserId}
              onChange={(e) => table.setFilter('listenerUserId', e.target.value)}
              placeholder="UUID"
            />
          </Field>
        </FilterBar>

        <DataTable
          columns={columns}
          rows={data?.data || []}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          emptyTitle="No payouts yet"
          emptyDescription="Create a manual payout for a listener with pending earnings, or enable weekly/monthly under Configuration."
          onRowClick={(row) => setDetailId(row.id)}
        />
        <Pagination meta={data?.meta} page={table.page} onPageChange={table.setPage} />
      </Card>

      <CreatePayoutModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <PayoutDetailModal payoutId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}
