import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Ban, Plus, Trash2 } from 'lucide-react';
import { blocksApi } from '../api/endpoints';
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
  SearchInput,
  Textarea,
} from '../components/ui';
import { useTableState } from '../hooks/useTableState';
import { fmtDateTime, shortId } from '../lib/format';

function CreateBlockModal({ open, onClose }) {
  const [form, setForm] = useState({
    listenerId: '',
    callerId: '',
    reason: '',
  });

  const mutation = useApiMutation({
    mutationFn: (body) => blocksApi.create(body),
    successMessage: 'Listener→caller block created',
    invalidate: [['blocks']],
    onSuccess: () => {
      setForm({ listenerId: '', callerId: '', reason: '' });
      onClose();
    },
  });

  const submit = () =>
    mutation.mutate({
      listenerId: form.listenerId.trim(),
      callerId: form.callerId.trim(),
      reason: form.reason.trim() || undefined,
    });

  const fieldErrors = mutation.error?.fieldErrors || {};

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Block caller for a listener"
      description="Creates a social block (listener will not receive calls from that caller). Does not ban the caller account."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            loading={mutation.isPending}
            disabled={!form.listenerId.trim() || !form.callerId.trim()}
          >
            Create block
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {mutation.error && <ErrorState error={mutation.error} compact />}
        <Field label="Listener user ID" required error={fieldErrors.listenerId} hint="UUID of the listener (User id)">
          <Input
            autoFocus
            value={form.listenerId}
            onChange={(e) => setForm({ ...form, listenerId: e.target.value })}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
        </Field>
        <Field label="Caller user ID" required error={fieldErrors.callerId} hint="UUID of the caller (User id)">
          <Input
            value={form.callerId}
            onChange={(e) => setForm({ ...form, callerId: e.target.value })}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
        </Field>
        <Field label="Reason" error={fieldErrors.reason}>
          <Textarea
            rows={3}
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            placeholder="Optional note shown to the caller on their block list"
          />
        </Field>
      </div>
    </Modal>
  );
}

export function ListenerBlocksPage() {
  const { can } = useAuth();
  const writable = can(P.BLOCKS_WRITE);
  const [createOpen, setCreateOpen] = useState(false);

  const table = useTableState({
    listenerId: '',
    callerId: '',
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.blocks(table.params),
    queryFn: () => blocksApi.list(table.params),
  });

  const remove = useApiMutation({
    mutationFn: (id) => blocksApi.remove(id),
    successMessage: 'Block removed',
    invalidate: [['blocks']],
  });

  const columns = [
    {
      key: 'listener',
      header: 'Listener',
      render: (row) => (
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-900">{row.listenerName || '—'}</p>
          <p className="font-mono text-[11px] text-ink-500">{shortId(row.listenerId)}</p>
        </div>
      ),
    },
    {
      key: 'caller',
      header: 'Blocked caller',
      render: (row) => (
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-900">{row.callerName || '—'}</p>
          <p className="font-mono text-[11px] text-ink-500">{shortId(row.callerId)}</p>
          {row.callerMobile ? <p className="text-[11px] text-ink-500">{row.callerMobile}</p> : null}
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (row) => <span className="text-sm text-ink-700">{row.reason || '—'}</span>,
    },
    {
      key: 'blockedAt',
      header: 'Blocked at',
      render: (row) => fmtDateTime(row.blockedAt),
    },
  ];

  if (writable) {
    columns.push({
      key: 'actions',
      header: '',
      className: 'w-28',
      render: (row) => (
        <Button
          size="sm"
          variant="ghost"
          icon={Trash2}
          loading={remove.isPending && remove.variables === row.id}
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Remove this block?')) remove.mutate(row.id);
          }}
        >
          Remove
        </Button>
      ),
    });
  }

  return (
    <>
      <PageHeader
        title="Listener blocks"
        description="Admin-managed listener→caller blocks. Callers see who blocked them via GET /users/me/blocked-by-listeners."
        actions={
          writable ? (
            <Button icon={Plus} onClick={() => setCreateOpen(true)}>
              Create block
            </Button>
          ) : null
        }
      />

      <Card>
        <FilterBar onReset={table.isFiltered ? table.reset : undefined}>
          <Field label="Listener ID" className="w-52">
            <SearchInput
              value={table.filters.listenerId}
              onChange={(v) => table.setFilter('listenerId', v)}
              placeholder="UUID"
            />
          </Field>
          <Field label="Caller ID" className="w-52">
            <SearchInput
              value={table.filters.callerId}
              onChange={(v) => table.setFilter('callerId', v)}
              placeholder="UUID"
            />
          </Field>
        </FilterBar>

        <DataTable
          columns={columns}
          rows={data?.data}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          emptyIcon={Ban}
          emptyTitle="No blocks yet"
          emptyDescription="Create a block so a listener will not receive calls from a specific caller."
        />

        <Pagination
          meta={data?.meta}
          onPageChange={table.setPage}
          onLimitChange={table.changeLimit}
        />
      </Card>

      <CreateBlockModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
