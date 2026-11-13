import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dailyPayoutsApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { useApiMutation } from '../hooks/useApiMutation';
import { useAuth } from '../auth/AuthContext';
import { P } from '../auth/permissions';
import { DataTable, FilterBar, Pagination } from '../components/DataTable';
import {
  Button,
  ErrorState,
  Field,
  Modal,
  PageHeader,
  Select,
  StatusBadge,
  Textarea,
} from '../components/ui';
import { useTableState } from '../hooks/useTableState';
import { fmtDateTime, fmtPaise, shortId } from '../lib/format';

function RejectModal({ payoutId, onClose }) {
  const [reason, setReason] = useState('');
  const mutation = useApiMutation({
    mutationFn: () => dailyPayoutsApi.reject(payoutId, { reason: reason.trim() || undefined }),
    successMessage: 'Daily payout rejected',
    invalidate: [['daily-payouts']],
    onSuccess: onClose,
  });

  return (
    <Modal
      open={Boolean(payoutId)}
      onClose={onClose}
      title="Reject daily payout"
      description="Reserved earnings return to PENDING and stay available for weekly bank payout."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Reject
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {mutation.error && <ErrorState error={mutation.error} compact />}
        <Field label="Reason (optional)">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
        </Field>
      </div>
    </Modal>
  );
}

function DetailModal({ payoutId, onClose }) {
  const canWrite = useAuth().can(P.PAYOUTS_WRITE);
  const { data, isLoading, error } = useQuery({
    queryKey: qk.dailyPayout(payoutId),
    queryFn: () => dailyPayoutsApi.get(payoutId),
    enabled: Boolean(payoutId),
  });

  const approve = useApiMutation({
    mutationFn: () => dailyPayoutsApi.approve(payoutId),
    successMessage: 'Daily payout approved and sent to Razorpay',
    invalidate: [qk.dailyPayout(payoutId), ['daily-payouts'], ['earnings']],
  });

  return (
    <Modal
      open={Boolean(payoutId)}
      onClose={onClose}
      title={data ? `Daily payout ${shortId(data.id)}` : 'Daily payout'}
      description={data ? `${fmtPaise(data.amountPaise)} · max ${data.maxPercent}%` : undefined}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {canWrite && data?.status === 'PENDING_APPROVAL' && (
            <Button loading={approve.isPending} onClick={() => approve.mutate()}>
              Approve & pay
            </Button>
          )}
        </>
      }
    >
      {isLoading && <p className="text-sm text-ink-500">Loading…</p>}
      {error && <ErrorState error={error} />}
      {approve.error && <ErrorState error={approve.error} compact />}
      {data && (
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={data.status} />
            <span className="font-mono text-xs text-ink-500">{data.transferRef}</span>
          </div>
          <p>
            Listener:{' '}
            {data.listener?.displayName || data.listener?.name || shortId(data.listenerUserId)}
          </p>
          <p>
            Available at request: {fmtPaise(data.availablePaise)} · Requested:{' '}
            {fmtPaise(data.amountPaise)}
          </p>
          {data.razorpayPayoutId && (
            <p className="font-mono text-xs">Razorpay: {data.razorpayPayoutId}</p>
          )}
          {data.razorpayUtr && <p className="font-mono text-xs">UTR: {data.razorpayUtr}</p>}
          {data.failureReason && <p className="text-amber-700">{data.failureReason}</p>}
          {data.rejectionReason && <p className="text-amber-700">{data.rejectionReason}</p>}
          {Array.isArray(data.earnings) && data.earnings.length > 0 && (
            <div>
              <p className="mb-1 font-medium">Reserved earnings ({data.earnings.length})</p>
              <ul className="max-h-48 space-y-1 overflow-auto text-xs">
                {data.earnings.map((e) => (
                  <li key={e.id} className="flex justify-between gap-2 font-mono">
                    <span>{shortId(e.id)}</span>
                    <span>
                      {e.kind} · {fmtPaise(e.amountPaise)} · {e.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

export function DailyPayoutsPage() {
  const canWrite = useAuth().can(P.PAYOUTS_WRITE);
  const table = useTableState({ status: 'PENDING_APPROVAL' });
  const [detailId, setDetailId] = useState(null);
  const [rejectId, setRejectId] = useState(null);

  const { data, isLoading, error } = useQuery({
    queryKey: qk.dailyPayouts(table.params),
    queryFn: () => dailyPayoutsApi.list(table.params),
  });

  const approve = useApiMutation({
    mutationFn: (id) => dailyPayoutsApi.approve(id),
    successMessage: 'Approved and sent to Razorpay',
    invalidate: [['daily-payouts'], ['earnings']],
  });

  const columns = [
    {
      key: 'listener',
      header: 'Listener',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">
            {row.listener?.displayName || row.listener?.name || '—'}
          </p>
          <p className="font-mono text-xs text-ink-500">{shortId(row.listenerUserId)}</p>
          {row.listenerUserId && (
            <Link
              className="text-xs text-brand-700 hover:underline"
              to={`/listeners?search=${row.listenerUserId}`}
            >
              Find listener
            </Link>
          )}
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (row) => (
        <div className="text-sm">
          <p className="font-medium">{fmtPaise(row.amountPaise)}</p>
          <p className="text-xs text-ink-500">
            of {fmtPaise(row.availablePaise)} · ≤{row.maxPercent}%
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'requestedAt',
      header: 'Requested',
      render: (row) => (
        <span className="text-xs text-ink-600">{fmtDateTime(row.requestedAt || row.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex flex-wrap justify-end gap-1">
          <Button size="sm" variant="secondary" onClick={() => setDetailId(row.id)}>
            View
          </Button>
          {canWrite && row.status === 'PENDING_APPROVAL' && (
            <>
              <Button
                size="sm"
                loading={approve.isPending}
                onClick={() => approve.mutate(row.id)}
              >
                Approve
              </Button>
              <Button size="sm" variant="danger" onClick={() => setRejectId(row.id)}>
                Reject
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Daily Razorpay payouts"
        description="Opt-in per listener (default off). Max 70% of available. Approval required by default before bank transfer. Weekly bank payouts stay in sync — reserved/paid daily amounts are excluded."
      />

      <FilterBar>
        <Select
          value={table.filters.status || ''}
          onChange={(e) => table.setFilter('status', e.target.value || undefined)}
        >
          <option value="">All statuses</option>
          <option value="PENDING_APPROVAL">Pending approval</option>
          <option value="QUEUED">Queued</option>
          <option value="PROCESSING">Processing</option>
          <option value="SUCCESS">Success</option>
          <option value="FAILED">Failed</option>
          <option value="REJECTED">Rejected</option>
        </Select>
      </FilterBar>

      {error && <ErrorState error={error} />}
      {approve.error && <ErrorState error={approve.error} compact />}

      <DataTable columns={columns} rows={data?.data || []} loading={isLoading} />
      <Pagination meta={data?.meta} onPageChange={table.setPage} />

      {detailId && <DetailModal payoutId={detailId} onClose={() => setDetailId(null)} />}
      {rejectId && <RejectModal payoutId={rejectId} onClose={() => setRejectId(null)} />}
    </div>
  );
}
