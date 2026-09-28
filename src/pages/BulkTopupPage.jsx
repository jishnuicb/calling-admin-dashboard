import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Gift, Play, UserMinus } from 'lucide-react';
import { bulkTopupApi, usersApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { useApiMutation } from '../hooks/useApiMutation';
import { useAuth } from '../auth/AuthContext';
import { P } from '../auth/permissions';
import { Pagination } from '../components/DataTable';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
  Select,
  StatusBadge,
  Toggle,
} from '../components/ui';
import { useTableState, useDebounced } from '../hooks/useTableState';
import { fmtDateTime, fmtNumber, fmtTokens, shortId } from '../lib/format';

/** Write access for bulk top-up actions (bonuses OR wallet adjust). */
function useBulkTopupWrite() {
  const { can } = useAuth();
  return can(P.BONUSES_WRITE, P.WALLET_ADJUST);
}

function SettingsCard() {
  const writable = useBulkTopupWrite();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.bulkTopupSettings,
    queryFn: () => bulkTopupApi.settings(),
  });

  const [form, setForm] = useState({ enabled: false, tokensPerUser: 10 });

  useEffect(() => {
    if (!data) return;
    setForm({
      enabled: Boolean(data.enabled),
      tokensPerUser: data.tokensPerUser ?? 10,
    });
  }, [data]);

  const save = useApiMutation({
    mutationFn: (body) => bulkTopupApi.updateSettings(body),
    successMessage: 'Bulk top-up settings saved',
    invalidate: [['bulk-topup']],
  });

  if (isLoading) return <LoadingBlock label="Loading settings…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <Card
      title="Daily automatic top-up"
      description={`${data?.scheduleLabel || 'Daily at 12:30 AM'} · credits all ACTIVE users except AUTOMATIC exclusions.`}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Do not wrap Toggle in Field (<label>) — nested labels break the switch. */}
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink-700">
            {form.enabled ? 'Enabled' : 'Disabled'}
          </p>
          <Toggle
            checked={form.enabled}
            disabled={!writable || save.isPending}
            onChange={(checked) => setForm((f) => ({ ...f, enabled: checked }))}
            label={form.enabled ? 'On' : 'Off'}
          />
        </div>
        <Field label="Tokens per user" hint="Amount credited to each eligible active user.">
          <Input
            type="number"
            min={0}
            value={form.tokensPerUser}
            disabled={!writable || save.isPending}
            onChange={(e) =>
              setForm((f) => ({ ...f, tokensPerUser: Number(e.target.value || 0) }))
            }
          />
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          disabled={!writable}
          loading={save.isPending}
          onClick={() =>
            save.mutate({
              enabled: form.enabled,
              tokensPerUser: form.tokensPerUser,
            })
          }
        >
          Save settings
        </Button>
        {!writable && (
          <p className="text-xs text-amber-700">
            You need <code>bonuses:write</code> or <code>wallet:adjust</code> to change settings.
          </p>
        )}
      </div>
      {save.error && (
        <div className="mt-3">
          <ErrorState error={save.error} compact />
        </div>
      )}
    </Card>
  );
}

function ManualRunCard() {
  const writable = useBulkTopupWrite();
  const [tokensPerUser, setTokensPerUser] = useState('');
  const [note, setNote] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const settings = useQuery({
    queryKey: qk.bulkTopupSettings,
    queryFn: () => bulkTopupApi.settings(),
  });

  const run = useApiMutation({
    mutationFn: (body) => bulkTopupApi.runManual(body),
    successMessage: (data) =>
      data?.run
        ? `Manual top-up finished — ${data.run.creditedCount} credited, ${data.run.excludedCount} excluded`
        : 'Manual top-up finished',
    invalidate: [['bulk-topup'], ['wallet']],
    onSuccess: () => {
      setConfirmOpen(false);
      setNote('');
    },
  });

  const effectiveTokens =
    tokensPerUser === '' ? settings.data?.tokensPerUser : Number(tokensPerUser);

  return (
    <>
      <Card
        title="Manual bulk top-up"
        description="Credits all ACTIVE users now, respecting the MANUAL exclusion list (separate from automatic)."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tokens per user" hint="Leave blank to use the saved setting.">
            <Input
              type="number"
              min={1}
              placeholder={String(settings.data?.tokensPerUser ?? 10)}
              value={tokensPerUser}
              disabled={!writable}
              onChange={(e) => setTokensPerUser(e.target.value)}
            />
          </Field>
          <Field label="Note (optional)">
            <Input
              value={note}
              maxLength={500}
              placeholder="Reason for this manual run"
              disabled={!writable}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            disabled={!writable}
            onClick={() => setConfirmOpen(true)}
          >
            <Play className="size-4" />
            Run manual top-up
          </Button>
          {!writable && (
            <p className="text-xs text-amber-700">
              You need <code>bonuses:write</code> or <code>wallet:adjust</code> to run a manual top-up.
            </p>
          )}
        </div>
      </Card>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirm manual bulk top-up"
        description="This credits real wallets for every ACTIVE user not on the MANUAL exclusion list."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={run.isPending}
              onClick={() =>
                run.mutate({
                  ...(tokensPerUser !== '' ? { tokensPerUser: Number(tokensPerUser) } : {}),
                  note: note || undefined,
                })
              }
            >
              Confirm &amp; credit
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-700">
          Tokens per user: <strong>{fmtTokens(effectiveTokens || 0)}</strong>
        </p>
        {run.error && (
          <div className="mt-3">
            <ErrorState error={run.error} compact />
          </div>
        )}
      </Modal>
    </>
  );
}

function ExclusionsCard() {
  const writable = useBulkTopupWrite();
  const table = useTableState({ scope: 'AUTOMATIC', search: '' }, { limit: 20 });
  const [userSearch, setUserSearch] = useState('');
  const debouncedUserSearch = useDebounced(userSearch, 350);
  const [selectedUser, setSelectedUser] = useState(null);
  const [reason, setReason] = useState('');
  const [addScope, setAddScope] = useState('AUTOMATIC');

  const params = {
    page: table.page,
    limit: table.pageSize,
    scope: table.filters.scope || undefined,
    search: table.filters.search || undefined,
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.bulkTopupExclusions(params),
    queryFn: () => bulkTopupApi.exclusions(params),
  });

  const userResults = useQuery({
    queryKey: ['users', 'bulk-topup-exclude-search', debouncedUserSearch],
    queryFn: () => usersApi.list({ search: debouncedUserSearch, limit: 10, page: 1 }),
    enabled: writable && debouncedUserSearch.trim().length >= 2,
  });

  const add = useApiMutation({
    mutationFn: (body) => bulkTopupApi.addExclusion(body),
    successMessage: 'User excluded',
    invalidate: [['bulk-topup', 'exclusions']],
    onSuccess: () => {
      setUserSearch('');
      setSelectedUser(null);
      setReason('');
    },
  });

  const remove = useApiMutation({
    mutationFn: ({ userId: id, scope }) => bulkTopupApi.removeExclusion(id, scope),
    successMessage: 'Exclusion removed',
    invalidate: [['bulk-topup', 'exclusions']],
  });

  const rows = data?.data || [];
  const pagination = data?.meta || data?.pagination;
  const foundUsers = userResults.data?.data || [];

  return (
    <Card
      title="Exclusion lists"
      description="AUTOMATIC and MANUAL exclusions are separate — a user can be excluded from one or both."
    >
      {writable && (
        <div className="mb-4 space-y-3 rounded-lg border border-ink-100 bg-ink-50/60 p-3">
          <p className="text-xs font-medium text-ink-600">Add exclusion — search users by name or mobile</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative sm:col-span-2">
              <Field label="Find user">
                <Input
                  placeholder="Type at least 2 characters…"
                  value={selectedUser ? selectedUser.label : userSearch}
                  onChange={(e) => {
                    setSelectedUser(null);
                    setUserSearch(e.target.value);
                  }}
                />
              </Field>
              {!selectedUser && debouncedUserSearch.trim().length >= 2 && (
                <div className="absolute left-0 right-0 z-20 mt-1 max-h-48 overflow-auto rounded-lg border border-ink-200 bg-white shadow-lg">
                  {userResults.isFetching && (
                    <p className="px-3 py-2 text-xs text-ink-500">Searching…</p>
                  )}
                  {!userResults.isFetching && foundUsers.length === 0 && (
                    <p className="px-3 py-2 text-xs text-ink-500">No users matched.</p>
                  )}
                  {foundUsers.map((u) => {
                    const label = `${u.name || 'User'} · ${u.mobile || shortId(u.id)}`;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-ink-50"
                        onClick={() => {
                          setSelectedUser({ id: u.id, label });
                          setUserSearch('');
                        }}
                      >
                        <span className="font-medium text-ink-900">{u.name || 'Unnamed'}</span>
                        <span className="ml-2 font-mono text-xs text-ink-500">
                          {u.mobile || shortId(u.id)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <Field label="Exclude from">
              <Select value={addScope} onChange={(e) => setAddScope(e.target.value)}>
                <option value="AUTOMATIC">Automatic</option>
                <option value="MANUAL">Manual</option>
              </Select>
            </Field>
            <Field label="Reason">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={!selectedUser}
              loading={add.isPending}
              onClick={() =>
                add.mutate({
                  userId: selectedUser.id,
                  scope: addScope,
                  reason: reason || undefined,
                })
              }
            >
              <UserMinus className="size-4" />
              Add exclusion
            </Button>
            {selectedUser && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelectedUser(null);
                  setUserSearch('');
                }}
              >
                Clear selection
              </Button>
            )}
          </div>
          {add.error && <ErrorState error={add.error} compact />}
        </div>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Scope filter">
          <Select
            value={table.filters.scope}
            onChange={(e) => table.setFilter('scope', e.target.value)}
          >
            <option value="">All scopes</option>
            <option value="AUTOMATIC">Automatic</option>
            <option value="MANUAL">Manual</option>
          </Select>
        </Field>
        <Field label="Search exclusions">
          <Input
            placeholder="Name or mobile in exclusion list…"
            value={table.filters.search}
            onChange={(e) => table.setFilter('search', e.target.value)}
          />
        </Field>
      </div>

      {isLoading && <LoadingBlock label="Loading exclusions…" />}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {!isLoading && !error && rows.length === 0 && (
        <EmptyState icon={UserMinus} title="No exclusions" description="No users excluded yet." />
      )}
      {!isLoading && !error && rows.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-ink-200 text-left text-sm">
              <thead className="bg-ink-50 text-xs font-semibold text-ink-600">
                <tr>
                  <th className="px-3 py-2.5">User</th>
                  <th className="px-3 py-2.5">Mobile</th>
                  <th className="px-3 py-2.5">Scope</th>
                  <th className="px-3 py-2.5">Reason</th>
                  <th className="px-3 py-2.5">Added</th>
                  <th className="px-3 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-white">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2">
                      <p className="font-medium text-ink-900">{row.user?.name || '—'}</p>
                      <p className="font-mono text-[11px] text-ink-400">{shortId(row.userId)}</p>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-ink-600">
                      {row.user?.mobile || '—'}
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={row.scope === 'AUTOMATIC' ? 'info' : 'warning'}>{row.scope}</Badge>
                    </td>
                    <td className="px-3 py-2 text-ink-600">{row.reason || '—'}</td>
                    <td className="px-3 py-2 text-xs text-ink-500">{fmtDateTime(row.createdAt)}</td>
                    <td className="px-3 py-2 text-right">
                      {writable && (
                        <Button
                          size="sm"
                          variant="danger"
                          loading={remove.isPending}
                          onClick={() => remove.mutate({ userId: row.userId, scope: row.scope })}
                        >
                          Remove
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagination && (pagination.totalPages > 1 || pagination.total > table.pageSize) && (
            <div className="border-t border-ink-100 p-3">
              <Pagination
                page={pagination.page || table.page}
                limit={pagination.limit || table.pageSize}
                total={pagination.total}
                totalPages={pagination.totalPages}
                onPageChange={table.setPage}
                onLimitChange={table.changeLimit}
              />
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function AwardsModal({ runId, onClose }) {
  const table = useTableState({ status: '', search: '' }, { limit: 20 });
  const params = {
    page: table.page,
    limit: table.pageSize,
    status: table.filters.status || undefined,
    search: table.filters.search || undefined,
  };
  const { data, isLoading, error } = useQuery({
    queryKey: qk.bulkTopupAwards(runId, params),
    queryFn: () => bulkTopupApi.awards(runId, params),
    enabled: Boolean(runId),
  });
  const rows = data?.data || [];
  const pagination = data?.meta || data?.pagination;

  return (
    <Modal
      open
      onClose={onClose}
      title="Top-up awards"
      description={`Run ${shortId(runId)}`}
      size="xl"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        <Select
          value={table.filters.status}
          onChange={(e) => table.setFilter('status', e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="CREDITED">Credited</option>
          <option value="EXCLUDED">Excluded</option>
          <option value="SKIPPED">Skipped</option>
          <option value="FAILED">Failed</option>
        </Select>
        <Input
          placeholder="Search name or mobile…"
          value={table.filters.search}
          onChange={(e) => table.setFilter('search', e.target.value)}
        />
      </div>
      {isLoading && <LoadingBlock label="Loading awards…" />}
      {error && <ErrorState error={error} />}
      {!isLoading && !error && (
        <div className="max-h-96 overflow-auto rounded-lg border border-ink-200">
          <table className="min-w-full divide-y divide-ink-200 text-left text-xs">
            <thead className="sticky top-0 bg-ink-50 font-semibold text-ink-600">
              <tr>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Mobile</th>
                <th className="px-3 py-2">Tokens</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 bg-white">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2">{row.user?.name || shortId(row.userId)}</td>
                  <td className="px-3 py-2 font-mono">{row.user?.mobile || '—'}</td>
                  <td className="px-3 py-2">{fmtTokens(row.tokensAwarded)}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-3">
          <Pagination
            page={pagination.page}
            limit={pagination.limit}
            total={pagination.total}
            totalPages={pagination.totalPages}
            onPageChange={table.setPage}
            onLimitChange={table.changeLimit}
          />
        </div>
      )}
    </Modal>
  );
}

function HistoryCard() {
  const [selectedRunId, setSelectedRunId] = useState(null);
  const table = useTableState(
    { source: '', status: '', from: '', to: '' },
    { limit: 20 },
  );

  const params = {
    page: table.page,
    limit: table.pageSize,
    source: table.filters.source || undefined,
    status: table.filters.status || undefined,
    from: table.filters.from || undefined,
    to: table.filters.to || undefined,
  };

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: qk.bulkTopupRuns(params),
    queryFn: () => bulkTopupApi.runs(params),
  });

  const rows = data?.data || [];
  const pagination = data?.meta || data?.pagination;

  return (
    <>
      <Card
        title="Top-up history"
        description="Filter by automatic/manual, status, and date range."
        actions={
          <Button variant="secondary" size="sm" loading={isFetching} onClick={() => refetch()}>
            Refresh
          </Button>
        }
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Source">
            <Select
              value={table.filters.source}
              onChange={(e) => table.setFilter('source', e.target.value)}
            >
              <option value="">All</option>
              <option value="AUTOMATIC">Automatic</option>
              <option value="MANUAL">Manual</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select
              value={table.filters.status}
              onChange={(e) => table.setFilter('status', e.target.value)}
            >
              <option value="">All</option>
              <option value="COMPLETED">Completed</option>
              <option value="RUNNING">Running</option>
              <option value="FAILED">Failed</option>
              <option value="SKIPPED">Skipped</option>
            </Select>
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
        </div>

        {isLoading && <LoadingBlock label="Loading history…" />}
        {error && <ErrorState error={error} onRetry={refetch} />}
        {!isLoading && !error && rows.length === 0 && (
          <EmptyState
            icon={Gift}
            title="No top-up runs yet"
            description="Automatic or manual runs will appear here."
          />
        )}
        {!isLoading && !error && rows.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-ink-200 text-left text-sm">
                <thead className="bg-ink-50 text-xs font-semibold text-ink-600">
                  <tr>
                    <th className="px-3 py-2.5">When</th>
                    <th className="px-3 py-2.5">Source</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Tokens / user</th>
                    <th className="px-3 py-2.5">Credited</th>
                    <th className="px-3 py-2.5">Excluded</th>
                    <th className="px-3 py-2.5">Total tokens</th>
                    <th className="px-3 py-2.5 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 bg-white">
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-3 py-2 text-xs text-ink-600">
                        <div>{fmtDateTime(row.startedAt)}</div>
                        <div className="text-ink-400">{row.runDate}</div>
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={row.source === 'AUTOMATIC' ? 'info' : 'warning'}>
                          {row.source}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-3 py-2">{fmtTokens(row.tokensPerUser)}</td>
                      <td className="px-3 py-2">{fmtNumber(row.creditedCount)}</td>
                      <td className="px-3 py-2">{fmtNumber(row.excludedCount)}</td>
                      <td className="px-3 py-2 font-medium">
                        {fmtTokens(row.totalTokensCredited)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="secondary" onClick={() => setSelectedRunId(row.id)}>
                          Awards
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pagination && pagination.totalPages > 1 && (
              <div className="border-t border-ink-100 p-3">
                <Pagination
                  page={pagination.page}
                  limit={pagination.limit}
                  total={pagination.total}
                  totalPages={pagination.totalPages}
                  onPageChange={table.setPage}
                  onLimitChange={table.changeLimit}
                />
              </div>
            )}
          </>
        )}
      </Card>

      {selectedRunId && (
        <AwardsModal runId={selectedRunId} onClose={() => setSelectedRunId(null)} />
      )}
    </>
  );
}

export function BulkTopupPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Bulk wallet top-up"
        description="Daily automatic credits at 12:30 AM, manual bulk runs, separate exclusion lists, and full history."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <SettingsCard />
        <ManualRunCard />
      </div>
      <ExclusionsCard />
      <HistoryCard />
    </div>
  );
}

export default BulkTopupPage;
