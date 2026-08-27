import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserX } from 'lucide-react';
import { accountDeletionApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { useApiMutation } from '../hooks/useApiMutation';
import { useAuth } from '../auth/AuthContext';
import { P } from '../auth/permissions';
import { DataTable, FilterBar, Pagination } from '../components/DataTable';
import {
  Button,
  Card,
  Field,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  StatusBadge,
  Textarea,
} from '../components/ui';
import { useTableState } from '../hooks/useTableState';
import { fmtDateTime, shortId } from '../lib/format';

function ReviewModal({ open, row, mode, onClose }) {
  const [adminNote, setAdminNote] = useState('');
  const isApprove = mode === 'approve';

  const mutation = useApiMutation({
    mutationFn: () =>
      isApprove
        ? accountDeletionApi.approve(row.id, { adminNote: adminNote.trim() || undefined })
        : accountDeletionApi.reject(row.id, { adminNote: adminNote.trim() || undefined }),
    successMessage: isApprove
      ? 'Request approved — account soft-deleted'
      : 'Deletion request rejected',
    invalidate: [['accountDeletion']],
    onSuccess: () => {
      setAdminNote('');
      onClose();
    },
  });

  if (!row) return null;

  return (
    <Modal
      open={open}
      onClose={() => !mutation.isPending && onClose()}
      title={isApprove ? 'Approve account deletion' : 'Reject deletion request'}
      description={
        isApprove
          ? 'Approving soft-deletes the user (status DELETED). Sessions and device tokens are revoked.'
          : 'The account stays active. The requester can submit again later if needed.'
      }
      size="sm"
      footer={
        <>
          <Button variant="secondary" disabled={mutation.isPending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={isApprove ? 'danger' : 'primary'}
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {isApprove ? 'Approve & delete' : 'Reject'}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-500">User</p>
          <p className="mt-0.5 font-medium text-ink-900">{row.name || row.userName || '—'}</p>
          <p className="text-[11px] text-ink-500">{row.mobile}</p>
          <p className="font-mono text-[11px] text-ink-500">{shortId(row.userId)}</p>
        </div>
        {row.reason ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Reason</p>
            <p className="mt-0.5 text-ink-700">{row.reason}</p>
          </div>
        ) : null}
        <Field label="Admin note (optional)">
          <Textarea
            rows={3}
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            placeholder="Internal note"
          />
        </Field>
      </div>
    </Modal>
  );
}

export function AccountDeletionPage() {
  const { can } = useAuth();
  const canReview = can(P.ACCOUNT_DELETION_REVIEW);
  const [review, setReview] = useState({ open: false, row: null, mode: 'approve' });

  const table = useTableState({
    status: 'PENDING',
    search: '',
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.accountDeletion(table.params),
    queryFn: () => accountDeletionApi.list(table.params),
  });

  const columns = [
    {
      key: 'user',
      header: 'User',
      render: (row) => (
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-900">{row.name || row.userName || '—'}</p>
          <p className="text-xs text-ink-500">{row.mobile}</p>
          <p className="font-mono text-[11px] text-ink-500">{shortId(row.userId)}</p>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (row) => <span className="text-sm text-ink-700">{row.email || '—'}</span>,
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (row) => (
        <span className="line-clamp-2 text-sm text-ink-700">{row.reason || '—'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'createdAt',
      header: 'Requested',
      render: (row) => fmtDateTime(row.createdAt),
    },
  ];

  if (canReview) {
    columns.push({
      key: 'actions',
      header: '',
      className: 'w-44',
      render: (row) =>
        row.status === 'PENDING' ? (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="danger"
              onClick={(e) => {
                e.stopPropagation();
                setReview({ open: true, row, mode: 'approve' });
              }}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                setReview({ open: true, row, mode: 'reject' });
              }}
            >
              Reject
            </Button>
          </div>
        ) : (
          <span className="text-xs text-ink-500">{fmtDateTime(row.reviewedAt)}</span>
        ),
    });
  }

  return (
    <>
      <PageHeader
        title="Account deletion"
        description="Requests from the public deletion form. Approving soft-deletes the user (status DELETED)."
      />

      <Card>
        <FilterBar onReset={table.isFiltered ? table.reset : undefined}>
          <Field label="Status" className="w-40">
            <Select
              value={table.filters.status}
              onChange={(e) => table.setFilter('status', e.target.value)}
            >
              <option value="">All</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </Select>
          </Field>
          <Field label="Search" className="w-56">
            <SearchInput
              value={table.filters.search}
              onChange={(v) => table.setFilter('search', v)}
              placeholder="Name, phone, email…"
            />
          </Field>
        </FilterBar>

        <DataTable
          columns={columns}
          rows={data?.data}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          emptyIcon={UserX}
          emptyTitle="No deletion requests"
          emptyDescription="Public form submissions appear here for admin verification."
        />

        <Pagination
          meta={data?.meta}
          onPageChange={table.setPage}
          onLimitChange={table.changeLimit}
        />
      </Card>

      <ReviewModal
        open={review.open}
        row={review.row}
        mode={review.mode}
        onClose={() => setReview({ open: false, row: null, mode: 'approve' })}
      />
    </>
  );
}
