import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import { chatsApi } from '../api/endpoints';
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
  Select,
  StatusBadge,
  Textarea,
} from '../components/ui';
import { useTableState } from '../hooks/useTableState';
import { fmtDateTime, shortId } from '../lib/format';

function MessagesModal({ threadId, onClose }) {
  const { data, isLoading, error } = useQuery({
    queryKey: qk.chatMessages(threadId),
    queryFn: () => chatsApi.messages(threadId, { limit: 100 }),
    enabled: Boolean(threadId),
  });

  const rows = data?.data || [];

  return (
    <Modal
      open={Boolean(threadId)}
      onClose={onClose}
      title={threadId ? `Messages · ${shortId(threadId)}` : 'Messages'}
      description="Read-only DB messages for monitoring. Not a live chat window."
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {isLoading && <p className="text-sm text-ink-500">Loading…</p>}
      {error && <ErrorState error={error} />}
      {!isLoading && !error && !rows.length && (
        <p className="text-sm text-ink-500">No messages in this thread.</p>
      )}
      <ul className="max-h-96 space-y-2 overflow-auto text-sm">
        {rows.map((m) => (
          <li key={m.id} className="rounded border border-ink-100 px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-500">
              <span>
                {m.senderRole} · {shortId(m.senderUserId)}
              </span>
              <span>{fmtDateTime(m.createdAt)}</span>
            </div>
            <p className="mt-1 text-ink-800">{m.bodyDisplay || m.body}</p>
            {m.bodyOriginal && m.bodyOriginal !== (m.bodyDisplay || m.body) && (
              <p className="mt-1 text-xs text-ink-400">Original: {m.bodyOriginal}</p>
            )}
          </li>
        ))}
      </ul>
    </Modal>
  );
}

function BlockModal({ open, onClose }) {
  const [blockedUserId, setBlockedUserId] = useState('');
  const [peerUserId, setPeerUserId] = useState('');
  const [reason, setReason] = useState('');
  const mutation = useApiMutation({
    mutationFn: () =>
      chatsApi.block({
        blockedUserId: blockedUserId.trim(),
        peerUserId: peerUserId.trim() || undefined,
        reason: reason.trim() || undefined,
      }),
    successMessage: 'Chat block created',
    invalidate: [['chats']],
    onSuccess: () => {
      setBlockedUserId('');
      setPeerUserId('');
      setReason('');
      onClose();
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Block chat"
      description="Admin chat block. Leave peer empty to ban a user from all chat; set peer to block one pair."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={mutation.isPending}
            disabled={!blockedUserId.trim()}
            onClick={() => mutation.mutate()}
          >
            Block
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {mutation.error && <ErrorState error={mutation.error} compact />}
        <Field label="Blocked user id" required>
          <Input
            className="font-mono text-xs"
            value={blockedUserId}
            onChange={(e) => setBlockedUserId(e.target.value)}
            placeholder="UUID"
          />
        </Field>
        <Field label="Peer user id (optional pair block)">
          <Input
            className="font-mono text-xs"
            value={peerUserId}
            onChange={(e) => setPeerUserId(e.target.value)}
            placeholder="UUID"
          />
        </Field>
        <Field label="Reason">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
        </Field>
      </div>
    </Modal>
  );
}

export function ChatThreadsPage() {
  const canWrite = useAuth().can(P.CHATS_WRITE);
  const table = useTableState({ status: '', search: '' });
  const [detailId, setDetailId] = useState(null);
  const [blockOpen, setBlockOpen] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.chats(table.params),
    queryFn: () => chatsApi.list(table.params),
  });

  const columns = [
    {
      key: 'parties',
      header: 'Participants',
      render: (row) => (
        <div className="min-w-0 text-xs">
          <p className="font-medium text-ink-800">
            Caller: {row.caller?.name || shortId(row.callerUserId)}
          </p>
          <p className="text-ink-600">
            Host: {row.listener?.displayName || row.listener?.name || shortId(row.listenerUserId)}
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
      key: 'messages',
      header: 'Messages',
      align: 'right',
      render: (row) => row.messageCount ?? 0,
    },
    {
      key: 'last',
      header: 'Last message',
      render: (row) => (
        <span className="text-xs text-ink-600">
          {row.lastMessageAt ? fmtDateTime(row.lastMessageAt) : '—'}
        </span>
      ),
    },
    {
      key: 'expires',
      header: 'Expires',
      render: (row) => (
        <span className="text-xs text-ink-600">
          {row.expiresAt ? fmtDateTime(row.expiresAt) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <Button size="sm" variant="secondary" onClick={() => setDetailId(row.id)}>
          Messages
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="In-app chats"
        description="Monitor caller ↔ host chat threads from the database. Live delivery uses Firebase; this list is DB-only. Feature is off until chat.enabled is turned on in Config."
        actions={
          canWrite ? (
            <Button variant="secondary" onClick={() => setBlockOpen(true)}>
              Block chat
            </Button>
          ) : null
        }
      />

      <Card>
        <FilterBar>
          <SearchInput
            value={table.filters.search || ''}
            onChange={(v) => table.setFilter('search', v)}
            placeholder="Search name or mobile"
          />
          <Select
            value={table.filters.status || ''}
            onChange={(e) => table.setFilter('status', e.target.value || undefined)}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="EXPIRED">EXPIRED</option>
            <option value="BLOCKED">BLOCKED</option>
          </Select>
        </FilterBar>

        <DataTable
          columns={columns}
          rows={data?.data || []}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          emptyTitle="No chat threads"
          emptyDescription="Threads appear after users open chat from a valid call."
          emptyIcon={MessageSquare}
        />
        <Pagination meta={data?.meta} onPageChange={table.setPage} onLimitChange={table.changeLimit} />
      </Card>

      {detailId && <MessagesModal threadId={detailId} onClose={() => setDetailId(null)} />}
      <BlockModal open={blockOpen} onClose={() => setBlockOpen(false)} />
    </div>
  );
}
