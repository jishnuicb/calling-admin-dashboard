import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, RefreshCw, UserMinus, UserPlus } from 'lucide-react';
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
  Textarea,
} from '../components/ui';
import { shortId } from '../lib/format';

const EMPTY_SLOTS = () =>
  Array.from({ length: 5 }, (_, slotIndex) => ({
    slotIndex,
    displayName: '',
    bio: '',
    photoUrl: '',
  }));

function mergeIdentities(existing = []) {
  const slots = EMPTY_SLOTS();
  for (const row of existing) {
    if (row.slotIndex >= 0 && row.slotIndex < 5) {
      slots[row.slotIndex] = {
        slotIndex: row.slotIndex,
        displayName: row.displayName || '',
        bio: row.bio || '',
        photoUrl: row.photoUrl || '',
      };
    }
  }
  return slots;
}

function IdentityEditor({ row, canWrite, onSaved }) {
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState(() => mergeIdentities(row.identities));

  useEffect(() => {
    setSlots(mergeIdentities(row.identities));
  }, [row.identities, row.id]);

  const save = useApiMutation({
    mutationFn: () => {
      const identities = slots
        .filter((s) => s.displayName.trim().length >= 2)
        .map((s) => ({
          slotIndex: s.slotIndex,
          displayName: s.displayName.trim(),
          bio: s.bio.trim() || null,
          photoUrl: s.photoUrl.trim() || null,
        }));
      return listenersApi.upsertDecoyIdentities(row.userId, { identities });
    },
    successMessage: 'Identity combinations saved',
    invalidate: [qk.listenerDecoys],
    onSuccess: onSaved,
  });

  const uploadPhoto = useApiMutation({
    mutationFn: ({ slotIndex, file }) => {
      const formData = new FormData();
      formData.append('file', file);
      return listenersApi.uploadDecoyIdentityPhoto(row.userId, slotIndex, formData);
    },
    successMessage: 'Photo uploaded',
    invalidate: [qk.listenerDecoys],
    onSuccess: onSaved,
  });

  const updateSlot = (slotIndex, patch) => {
    setSlots((prev) =>
      prev.map((s) => (s.slotIndex === slotIndex ? { ...s, ...patch } : s)),
    );
  };

  return (
    <div className="border-t border-ink-50 bg-ink-50/40 px-2 py-3">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left text-sm font-medium text-ink-800"
        onClick={() => setOpen((v) => !v)}
      >
        <span>
          Identity combinations (name + bio + photo) · {row.identities?.length || 0}/5 saved
          {row.currentIdentityIndex != null ? (
            <span className="ml-2 text-xs font-normal text-ink-500">
              live slot {row.currentIdentityIndex}
            </span>
          ) : null}
          {row.rotateOffline ? (
            <Badge tone="warning" className="ml-2">
              Rotating offline
            </Badge>
          ) : null}
        </span>
        {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </button>

      {open ? (
        <div className="mt-3 space-y-4">
          <p className="text-xs text-ink-500">
            Each row is one fixed combination. Name, bio and photo always stay together — they are
            never mixed. Leave a slot blank to skip it. On rotate, a different saved slot is chosen
            at random (not the one just used).
          </p>
          {slots.map((slot) => (
            <div
              key={slot.slotIndex}
              className="rounded-lg border border-ink-100 bg-white p-3 shadow-sm"
            >
              <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-ink-500">
                <span>Combination {slot.slotIndex + 1}</span>
                {row.currentIdentityIndex === slot.slotIndex ? (
                  <Badge tone="success">Currently live</Badge>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-[96px_1fr]">
                <div>
                  {slot.photoUrl ? (
                    <img
                      src={slot.photoUrl}
                      alt=""
                      className="size-20 rounded-full object-cover ring-1 ring-ink-200"
                    />
                  ) : (
                    <div className="flex size-20 items-center justify-center rounded-full bg-ink-100 text-xs text-ink-400">
                      No photo
                    </div>
                  )}
                  {canWrite ? (
                    <label className="mt-2 block cursor-pointer text-xs text-brand-700 hover:underline">
                      Upload photo
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            uploadPhoto.mutate({ slotIndex: slot.slotIndex, file });
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Field label="Display name (max 15)">
                    <Input
                      value={slot.displayName}
                      maxLength={15}
                      disabled={!canWrite}
                      onChange={(e) => updateSlot(slot.slotIndex, { displayName: e.target.value })}
                    />
                  </Field>
                  <Field label="Bio / description">
                    <Textarea
                      rows={2}
                      value={slot.bio}
                      disabled={!canWrite}
                      onChange={(e) => updateSlot(slot.slotIndex, { bio: e.target.value })}
                    />
                  </Field>
                  <Field label="Photo URL (optional if uploaded)">
                    <Input
                      value={slot.photoUrl}
                      disabled={!canWrite}
                      onChange={(e) => updateSlot(slot.slotIndex, { photoUrl: e.target.value })}
                      placeholder="https://…"
                    />
                  </Field>
                </div>
              </div>
            </div>
          ))}
          {canWrite ? (
            <Button onClick={() => save.mutate()} loading={save.isPending}>
              Save combinations
            </Button>
          ) : null}
          {save.error ? <ErrorState error={save.error} compact /> : null}
          {uploadPhoto.error ? <ErrorState error={uploadPhoto.error} compact /> : null}
        </div>
      ) : null}
    </div>
  );
}

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
        description="Mark real APPROVED listeners to always appear busy. Configure up to 5 name+bio+photo combinations per decoy; one randomly leaves the list on a timer and returns with a different combo."
        actions={
          canWrite ? (
            <Button variant="secondary" loading={sync.isPending} onClick={() => sync.mutate()}>
              <RefreshCw className="size-4" />
              Re-sync slots
            </Button>
          ) : null
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Feature">
          <p className="text-sm text-ink-700">
            {data?.enabled ? <Badge tone="success">Enabled</Badge> : <Badge tone="warning">Disabled</Badge>}
            <span className="ml-2 text-ink-500">Configuration → fakeListeners.enabled</span>
          </p>
        </Card>
        <Card title="Active in list">
          <p className="text-2xl font-semibold text-ink-900">
            {data?.activeCount ?? '—'}
            <span className="text-base font-normal text-ink-500"> / {data?.maxActive ?? '—'}</span>
          </p>
          <p className="mt-1 text-xs text-ink-500">Online + busy right now</p>
        </Card>
        <Card title="Rotate every">
          <p className="text-2xl font-semibold text-ink-900">
            {data?.rotateEveryMinutes ?? '—'}
            <span className="text-base font-normal text-ink-500"> min</span>
          </p>
          <p className="mt-1 text-xs text-ink-500">One random decoy leaves the list</p>
        </Card>
        <Card title="Offline window">
          <p className="text-2xl font-semibold text-ink-900">
            {data?.rotateOfflineSeconds ?? '—'}
            <span className="text-base font-normal text-ink-500"> sec</span>
          </p>
          <p className="mt-1 text-xs text-ink-500">Then back with a new combo</p>
        </Card>
      </div>

      {canWrite && (
        <Card
          title="Add by id"
          description="Paste an APPROVED listener application id or user id. Create the account in the app first, then approve it."
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
          <div className="divide-y divide-ink-50">
            {rows.map((row) => (
              <div key={row.id}>
                <div className="flex flex-wrap items-center gap-3 px-2 py-3">
                  {row.photoUrl ? (
                    <img
                      src={row.photoUrl}
                      alt=""
                      className="size-10 rounded-full object-cover ring-1 ring-ink-200"
                    />
                  ) : (
                    <span className="flex size-10 items-center justify-center rounded-full bg-ink-100 text-sm font-semibold text-ink-500">
                      {(row.displayName || '?').slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/listeners/${row.id}`}
                      className="font-medium text-ink-900 hover:underline"
                    >
                      {row.displayName || '—'}
                    </Link>
                    <div className="text-xs text-ink-500">
                      {row.gender} · {row.mobile || '—'} · app {shortId(row.id)} · user{' '}
                      {shortId(row.userId)}
                    </div>
                    {row.bio ? (
                      <p className="mt-0.5 line-clamp-1 text-xs text-ink-600">{row.bio}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {row.slotActive ? (
                      <Badge tone="success">In list</Badge>
                    ) : row.rotateOffline ? (
                      <Badge tone="warning">Rotate offline</Badge>
                    ) : (
                      <Badge tone="neutral">Parked</Badge>
                    )}
                    <span className="text-xs text-ink-500">
                      {row.online ? 'online' : 'offline'}
                      {row.busy ? ' · busy' : ' · free'}
                    </span>
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
                  </div>
                </div>
                <IdentityEditor row={row} canWrite={canWrite} onSaved={() => refetch()} />
              </div>
            ))}
          </div>
        ) : null}
      </Card>
    </>
  );
}
