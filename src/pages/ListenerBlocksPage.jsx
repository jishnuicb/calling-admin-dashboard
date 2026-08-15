import { useEffect, useState, useDeferredValue } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Ban, Plus, Trash2, X } from 'lucide-react';
import { blocksApi, listenersApi, usersApi } from '../api/endpoints';
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
  Modal,
  PageHeader,
  SearchInput,
  Textarea,
} from '../components/ui';
import { useTableState } from '../hooks/useTableState';
import { fmtDateTime, shortId } from '../lib/format';

/**
 * Search-by-name/phone picker. Selecting a row sets the underlying user id.
 * `mode: 'listener'` uses the listeners list (listeners only).
 * `mode: 'caller'` uses the users list.
 */
function PersonSearchPicker({ mode, value, selectedLabel, onSelect, onClear }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const deferredQuery = useDeferredValue(query.trim());
  const canSearch = deferredQuery.length >= 2;

  const listenersQuery = useQuery({
    queryKey: ['blocks', 'picker', 'listeners', deferredQuery],
    queryFn: () =>
      listenersApi.list({
        search: deferredQuery,
        status: 'APPROVED',
        page: 1,
        limit: 10,
      }),
    enabled: mode === 'listener' && canSearch && !value,
  });

  const usersQuery = useQuery({
    queryKey: ['blocks', 'picker', 'users', deferredQuery],
    queryFn: () =>
      usersApi.list({
        search: deferredQuery,
        page: 1,
        limit: 10,
      }),
    enabled: mode === 'caller' && canSearch && !value,
  });

  const active = mode === 'listener' ? listenersQuery : usersQuery;
  const rows = active.data?.data || [];

  const options =
    mode === 'listener'
      ? rows.map((row) => ({
          id: row.userId,
          title: row.displayName || row.user?.name || 'Unnamed',
          subtitle: row.user?.mobile || '—',
        }))
      : rows.map((row) => ({
          id: row.id,
          title: row.name || 'Unnamed',
          subtitle: row.mobile || '—',
        }));

  useEffect(() => {
    if (value) {
      setQuery('');
      setOpen(false);
    }
  }, [value]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink-900">{selectedLabel || shortId(value)}</p>
          <p className="font-mono text-[11px] text-ink-500">{shortId(value)}</p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
          aria-label="Clear selection"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <SearchInput
        value={query}
        onChange={(v) => {
          setQuery(v);
          setOpen(true);
        }}
        placeholder="Search by name or phone…"
      />
      {open && canSearch && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-ink-200 bg-white shadow-md">
          {active.isLoading ? (
            <p className="px-3 py-2 text-sm text-ink-500">Searching…</p>
          ) : active.error ? (
            <p className="px-3 py-2 text-sm text-red-600">Search failed. Try again.</p>
          ) : options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-ink-500">No matches</p>
          ) : (
            options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className="flex w-full flex-col items-start gap-0.5 border-b border-ink-100 px-3 py-2 text-left last:border-0 hover:bg-ink-50"
                onClick={() => {
                  onSelect({ id: opt.id, label: `${opt.title} · ${opt.subtitle}` });
                  setOpen(false);
                  setQuery('');
                }}
              >
                <span className="text-sm font-medium text-ink-900">{opt.title}</span>
                <span className="text-xs text-ink-500">{opt.subtitle}</span>
              </button>
            ))
          )}
        </div>
      )}
      {!canSearch && query.trim() ? (
        <p className="mt-1 text-xs text-ink-500">Type at least 2 characters</p>
      ) : null}
    </div>
  );
}

function CreateBlockModal({ open, onClose }) {
  const [listenerId, setListenerId] = useState('');
  const [listenerLabel, setListenerLabel] = useState('');
  const [callerId, setCallerId] = useState('');
  const [callerLabel, setCallerLabel] = useState('');
  const [reason, setReason] = useState('');

  const reset = () => {
    setListenerId('');
    setListenerLabel('');
    setCallerId('');
    setCallerLabel('');
    setReason('');
  };

  const mutation = useApiMutation({
    mutationFn: (body) => blocksApi.create(body),
    successMessage: 'Listener→caller block created',
    invalidate: [['blocks']],
    onSuccess: () => {
      reset();
      onClose();
    },
  });

  const submit = () =>
    mutation.mutate({
      listenerId,
      callerId,
      reason: reason.trim() || undefined,
    });

  const fieldErrors = mutation.error?.fieldErrors || {};

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Block caller for a listener"
      description="Search by name or phone, then select. Does not ban the caller account."
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            loading={mutation.isPending}
            disabled={!listenerId || !callerId}
          >
            Create block
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {mutation.error && <ErrorState error={mutation.error} compact />}
        <Field
          label="Listener"
          required
          error={fieldErrors.listenerId}
          hint="Only approved listeners appear in search results"
        >
          <PersonSearchPicker
            mode="listener"
            value={listenerId}
            selectedLabel={listenerLabel}
            onSelect={({ id, label }) => {
              setListenerId(id);
              setListenerLabel(label);
            }}
            onClear={() => {
              setListenerId('');
              setListenerLabel('');
            }}
          />
        </Field>
        <Field
          label="Caller (user)"
          required
          error={fieldErrors.callerId}
          hint="Search any user by name or phone"
        >
          <PersonSearchPicker
            mode="caller"
            value={callerId}
            selectedLabel={callerLabel}
            onSelect={({ id, label }) => {
              setCallerId(id);
              setCallerLabel(label);
            }}
            onClear={() => {
              setCallerId('');
              setCallerLabel('');
            }}
          />
        </Field>
        <Field label="Reason" error={fieldErrors.reason}>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
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
    successMessage: 'Caller unblocked',
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
            if (window.confirm('Unblock this caller for the listener?')) remove.mutate(row.id);
          }}
        >
          Unblock
        </Button>
      ),
    });
  }

  return (
    <>
      <PageHeader
        title="Listener blocks"
        description="Admin-managed listener→caller blocks. Search by name or phone to create a block; unblock anytime from the list."
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
