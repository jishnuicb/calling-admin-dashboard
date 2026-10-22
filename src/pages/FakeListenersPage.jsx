import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { RefreshCw, UserPlus, UserMinus } from 'lucide-react';
import { listenersApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { useApiMutation } from '../hooks/useApiMutation';
import { useAuth } from '../auth/AuthContext';
import { P } from '../auth/permissions';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingBlock,
  PageHeader,
} from '../components/ui';
import { shortId } from '../lib/format';

export function FakeListenersPage() {
  const { can } = useAuth();
  const canWrite = can(P.LISTENERS_APPROVE);
  const [listenerId, setListenerId] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.listenerDecoys,
    queryFn: () => listenersApi.listDecoys(),
  });

  const add = useApiMutation({
    mutationFn: () => listenersApi.addDecoy({ listenerId: listenerId.trim() }),
    successMessage: 'Listener added as discovery decoy',
    invalidate: [qk.listenerDecoys, ['listeners']],
    onSuccess: () => setListenerId(''),
  });

  const remove = useApiMutation({
    mutationFn: (id) => listenersApi.removeDecoy(id),
    successMessage: 'Removed from decoy pool',
    invalidate: [qk.listenerDecoys, ['listeners']],
  });

  const sync = useApiMutation({
    mutationFn: () => listenersApi.syncDecoys(),
    successMessage: 'Decoy slots re-synced',
    invalidate: [qk.listenerDecoys],
  });

  const rows = data?.data || [];

  return (
    <>
      <PageHeader
        title="Fake listeners (always busy)"
        description="Mark real APPROVED listeners to always appear in the caller list as busy. Change how many are active in Configuration → fakeListeners.maxActive."
        actions={
          canWrite ? (
            <Button
              variant="secondary"
              loading={sync.isPending}
              onClick={() => sync.mutate()}
            >
              <RefreshCw className="size-4" />
              Re-sync slots
            </Button>
          ) : null
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card title="Feature">
          <p className="text-sm text-ink-700">
            {data?.enabled ? (
              <Badge tone="success">Enabled</Badge>
            ) : (
              <Badge tone="warning">Disabled</Badge>
            )}
            <span className="ml-2 text-ink-500">
              Toggle via Configuration → fakeListeners.enabled
            </span>
          </p>
        </Card>
        <Card title="Active slots">
          <p className="text-2xl font-semibold text-ink-900">
            {data?.activeCount ?? '—'}
            <span className="text-base font-normal text-ink-500">
              {' '}
              / {data?.maxActive ?? '—'}
            </span>
          </p>
          <p className="mt-1 text-xs text-ink-500">Online + busy in discovery right now</p>
        </Card>
        <Card title="Marked decoys">
          <p className="text-2xl font-semibold text-ink-900">{data?.total ?? '—'}</p>
          <p className="mt-1 text-xs text-ink-500">
            Oldest pins fill slots first when maxActive changes
          </p>
        </Card>
      </div>

      {canWrite && (
        <Card
          title="Add by id"
          description="Paste an APPROVED listener application id or user id. Create the account normally in the app first (register → apply → approve)."
          className="mb-4"
        >
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Listener application id or user id" className="min-w-[280px] flex-1">
              <Input
                value={listenerId}
                onChange={(e) => setListenerId(e.target.value)}
                placeholder="uuid…"
                autoComplete="off"
              />
            </Field>
            <Button
              onClick={() => add.mutate()}
              loading={add.isPending}
              disabled={!listenerId.trim()}
            >
              <UserPlus className="size-4" />
              Add decoy
            </Button>
          </div>
          {add.error ? <ErrorState error={add.error} compact /> : null}
        </Card>
      )}

      <Card title="Decoy pool">
        {isLoading ? <LoadingBlock label="Loading decoys…" /> : null}
        {error ? <ErrorState error={error} onRetry={refetch} /> : null}
        {!isLoading && !error && !rows.length ? (
          <EmptyState title="No decoys yet" description="Add an approved listener by id above." />
        ) : null}
        {!isLoading && !error && rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-2 py-2 font-medium">Listener</th>
                  <th className="px-2 py-2 font-medium">Slot</th>
                  <th className="px-2 py-2 font-medium">Presence</th>
                  <th className="px-2 py-2 font-medium">Ids</th>
                  <th className="px-2 py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-2 py-2.5">
                      <Link
                        to={`/listeners/${row.id}`}
                        className="font-medium text-ink-900 hover:underline"
                      >
                        {row.displayName || '—'}
                      </Link>
                      <div className="text-xs text-ink-500">
                        {row.gender} · {row.mobile || '—'}
                      </div>
                    </td>
                    <td className="px-2 py-2.5">
                      {row.slotActive ? (
                        <Badge tone="success">In list</Badge>
                      ) : (
                        <Badge tone="neutral">Parked</Badge>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-xs text-ink-600">
                      {row.online ? 'online' : 'offline'}
                      {row.busy ? ' · busy' : ' · free'}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-xs text-ink-500">
                      app {shortId(row.id)}
                      <br />
                      user {shortId(row.userId)}
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      {canWrite ? (
                        <Button
                          variant="secondary"
                          loading={remove.isPending}
                          onClick={() => remove.mutate(row.userId)}
                        >
                          <UserMinus className="size-4" />
                          Remove
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>
    </>
  );
}
