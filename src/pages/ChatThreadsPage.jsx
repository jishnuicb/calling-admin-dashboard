import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Ban, MessageSquare } from 'lucide-react';
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
  const [chatKey, setChatKey] = useState('');
  const [appliedKey, setAppliedKey] = useState('');

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: qk.chatMessages(threadId, appliedKey ? `unlocked:${appliedKey.length}` : 'locked'),
    queryFn: () =>
      chatsApi.messagesWithKey(threadId, { limit: 100 }, appliedKey || undefined),
    enabled: Boolean(threadId),
    retry: false,
  });

  const rows = error ? [] : data?.data || [];
  const decrypted = Boolean(data?.decrypted) && !error;

  return (
    <Modal
      open={Boolean(threadId)}
      onClose={onClose}
      title={threadId ? `Messages · ${shortId(threadId)}` : 'Messages'}
      description="Bodies are encrypted at rest. Enter the permanent decryption key (same as bank/phone reveal). The key is never stored in env or the database."
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="mb-4 space-y-2">
        <Field
          label="Permanent decryption key"
          hint="Same key used to reveal listener phone and bank details. Never kept in .env."
        >
          <div className="flex flex-wrap gap-2">
            <Input
              type="password"
              name="chat-decryption-key"
              autoComplete="new-password"
              data-1p-ignore
              data-lpignore="true"
              data-form-type="other"
              className="min-w-[16rem] flex-1 font-mono text-xs"
              value={chatKey}
              onChange={(e) => setChatKey(e.target.value)}
              placeholder="Enter permanent decryption key"
            />
            <Button
              size="sm"
              loading={isFetching}
              disabled={chatKey.trim().length < 16}
              onClick={() => setAppliedKey(chatKey.trim())}
            >
              Reveal messages
            </Button>
            {appliedKey && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setAppliedKey('');
                  setChatKey('');
                }}
              >
                Hide
              </Button>
            )}
          </div>
        </Field>
        <p className="text-xs text-ink-500">
          {decrypted
            ? 'Showing decrypted message bodies for this view only.'
            : 'Showing [encrypted] until you reveal with the permanent key.'}
        </p>
      </div>

      {isLoading && <p className="text-sm text-ink-500">Loading…</p>}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {!isLoading && !error && !rows.length && (
        <p className="text-sm text-ink-500">No messages in this thread.</p>
      )}
      <ul className="max-h-96 space-y-2 overflow-auto text-sm">
        {rows.map((m) => (
          <li key={m.id} className="rounded border border-ink-100 px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-500">
              <span>
                {m.senderRole} · {shortId(m.senderUserId)}
                {m.encrypted ? ' · encrypted' : ''}
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

function personLabel(user, fallbackId) {
  if (!user) return shortId(fallbackId);
  return user.displayName || user.name || shortId(user.id || fallbackId);
}

export function ChatThreadsPage() {
  const canWrite = useAuth().can(P.CHATS_WRITE);
  const table = useTableState({ status: '', search: '' });
  const blocksTable = useTableState({ scope: '' });
  const [detailId, setDetailId] = useState(null);
  const [blockOpen, setBlockOpen] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.chats(table.params),
    queryFn: () => chatsApi.list(table.params),
  });

  const {
    data: blocksData,
    isLoading: blocksLoading,
    error: blocksError,
    refetch: refetchBlocks,
  } = useQuery({
    queryKey: qk.chatBlocks(blocksTable.params),
    queryFn: () => chatsApi.blocks(blocksTable.params),
  });

  const unblock = useApiMutation({
    mutationFn: (blockId) => chatsApi.unblock({ blockId }),
    successMessage: 'Chat unblocked',
    invalidate: [['chats']],
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

  const blockColumns = [
    {
      key: 'scope',
      header: 'Scope',
      render: (row) => <StatusBadge status={row.scope} />,
    },
    {
      key: 'blocker',
      header: 'Blocked by',
      render: (row) => (
        <div className="min-w-0 text-xs">
          <p className="font-medium text-ink-800">
            {row.blockerUserId ? personLabel(row.blocker, row.blockerUserId) : 'Admin (global)'}
          </p>
          {row.blockerUserId && (
            <p className="font-mono text-[11px] text-ink-500">{shortId(row.blockerUserId)}</p>
          )}
        </div>
      ),
    },
    {
      key: 'blocked',
      header: 'Blocked user',
      render: (row) => (
        <div className="min-w-0 text-xs">
          <p className="font-medium text-ink-800">{personLabel(row.blocked, row.blockedUserId)}</p>
          <p className="font-mono text-[11px] text-ink-500">{shortId(row.blockedUserId)}</p>
          {row.blocked?.mobile ? (
            <p className="text-[11px] text-ink-500">{row.blocked.mobile}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (row) => <span className="text-sm text-ink-700">{row.reason || '—'}</span>,
    },
    {
      key: 'createdAt',
      header: 'Blocked at',
      render: (row) => (
        <span className="text-xs text-ink-600">{fmtDateTime(row.createdAt)}</span>
      ),
    },
  ];

  if (canWrite) {
    blockColumns.push({
      key: 'actions',
      header: '',
      render: (row) => (
        <Button
          size="sm"
          variant="secondary"
          loading={unblock.isPending}
          onClick={() => unblock.mutate(row.id)}
        >
          Unblock
        </Button>
      ),
    });
  }

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

      <Card>
        <div className="border-b border-ink-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-ink-900">Chat blocks</h2>
          <p className="mt-0.5 text-xs text-ink-500">
            Includes in-app (HOST) blocks from the chat window and admin chat bans. Unblock restores
            chat for that pair.
          </p>
        </div>
        <FilterBar>
          <Select
            value={blocksTable.filters.scope || ''}
            onChange={(e) => blocksTable.setFilter('scope', e.target.value || undefined)}
          >
            <option value="">All scopes</option>
            <option value="HOST">HOST (in-app)</option>
            <option value="ADMIN">ADMIN</option>
          </Select>
        </FilterBar>
        <DataTable
          columns={blockColumns}
          rows={blocksData?.data || []}
          loading={blocksLoading}
          error={blocksError}
          onRetry={refetchBlocks}
          emptyTitle="No chat blocks"
          emptyDescription="When a host or caller blocks chat in-app, it shows here."
          emptyIcon={Ban}
        />
        <Pagination
          meta={blocksData?.meta}
          onPageChange={blocksTable.setPage}
          onLimitChange={blocksTable.changeLimit}
        />
      </Card>

      {detailId && <MessagesModal threadId={detailId} onClose={() => setDetailId(null)} />}
      <BlockModal open={blockOpen} onClose={() => setBlockOpen(false)} />
    </div>
  );
}
