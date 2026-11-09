import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Handshake, Plus } from 'lucide-react';
import { referralsApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { useApiMutation } from '../hooks/useApiMutation';
import { useAuth } from '../auth/AuthContext';
import { P } from '../auth/permissions';
import { DataTable, FilterBar, Pagination } from '../components/DataTable';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Textarea,
} from '../components/ui';
import { useTableState } from '../hooks/useTableState';
import { fmtDateTime, fmtNumber, shortId } from '../lib/format';

function personLabel(person, fallbackId) {
  if (!person) return shortId(fallbackId);
  const name = person.displayName || person.name;
  if (name && person.publicId) return `${name} · ${person.publicId}`;
  if (name) return name;
  if (person.publicId) return person.publicId;
  return shortId(person.id || fallbackId);
}

function StatusToneBadge({ status }) {
  const tone = status === 'ACTIVE' ? 'success' : status === 'STOPPED' ? 'danger' : 'neutral';
  return <Badge tone={tone}>{status || '—'}</Badge>;
}

/** Rough IST Monday YYYY-MM-DD for modal hint (server is authoritative). */
function currentIstWeekStartHint() {
  const now = new Date();
  const istMs = now.getTime() + 5.5 * 60 * 60 * 1000;
  const ist = new Date(istMs);
  const day = ist.getUTCDay(); // 0 Sun … 6 Sat in shifted clock
  const daysFromMonday = (day + 6) % 7;
  ist.setUTCDate(ist.getUTCDate() - daysFromMonday);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ist.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function CreateReferralModal({ open, onClose }) {
  const [form, setForm] = useState({
    referrerListenerUserId: '',
    referredUserId: '',
    bonusWeekStart: currentIstWeekStartHint(),
    referralBonusRupees: '',
    note: '',
  });

  const createReferral = useApiMutation({
    mutationFn: (body) => referralsApi.create(body),
    successMessage: 'Referral created',
    invalidate: [['referrals'], ['manual-weekly-payouts']],
    onSuccess: () => onClose(),
  });

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const weekHint = currentIstWeekStartHint();

  const submitReferral = () => {
    const body = {
      referrerListenerUserId: form.referrerListenerUserId.trim(),
      referredUserId: form.referredUserId.trim(),
      bonusWeekStart: form.bonusWeekStart,
      note: form.note.trim() || undefined,
    };
    if (form.referralBonusRupees !== '') {
      body.referralBonusRupees = Number(form.referralBonusRupees);
    }
    createReferral.mutate(body);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Create referral"
      description={`One-time referral bonus only. Pick the IST week (Mon–Sun) where the bonus appears in bank payout Referral bonus. Current IST week starts ${weekHint}. Use Incentives page for weekly incentive amounts.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submitReferral} loading={createReferral.isPending}>
            Create referral
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {createReferral.error && <ErrorState error={createReferral.error} compact />}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Referrer listener user ID" required hint="Approved listener UUID">
            <Input
              value={form.referrerListenerUserId}
              placeholder="UUID"
              onChange={(e) => set('referrerListenerUserId', e.target.value)}
            />
          </Field>
          <Field label="Referred user ID" required hint="Caller/user UUID">
            <Input
              value={form.referredUserId}
              placeholder="UUID"
              onChange={(e) => set('referredUserId', e.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Bonus week (IST Monday)"
            required
            hint="Week the one-time bonus is added to bank payout history"
          >
            <Input
              type="date"
              value={form.bonusWeekStart}
              onChange={(e) => set('bonusWeekStart', e.target.value)}
            />
          </Field>
          <Field label="Referral bonus (₹)" hint="One-time; blank = default from settings">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.referralBonusRupees}
              onChange={(e) => set('referralBonusRupees', e.target.value)}
            />
          </Field>
        </div>

        <Field label="Note">
          <Textarea
            rows={2}
            value={form.note}
            onChange={(e) => set('note', e.target.value)}
            placeholder="Optional admin note"
          />
        </Field>
      </div>
    </Modal>
  );
}

function ReferralDetailModal({ referralId, onClose }) {
  const { can } = useAuth();
  const writable = can(P.REFERRALS_WRITE);
  const [editForm, setEditForm] = useState(null);
  const [stopReason, setStopReason] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.referral(referralId),
    queryFn: () => referralsApi.get(referralId),
    enabled: Boolean(referralId),
  });

  const seeded = useMemo(() => {
    if (!data || editForm) return editForm;
    return {
      note: data.note || '',
      referralBonusRupees:
        data.referralBonusRupees != null ? String(data.referralBonusRupees) : '',
    };
  }, [data, editForm]);

  const form = editForm || seeded;

  const update = useApiMutation({
    mutationFn: (body) => referralsApi.update(referralId, body),
    successMessage: 'Referral updated',
    invalidate: [['referrals']],
    onSuccess: () => setEditForm(null),
  });

  const revert = useApiMutation({
    mutationFn: (body) => referralsApi.revert(referralId, body),
    successMessage: 'Referral reverted (removed from live bank payouts)',
    invalidate: [['referrals'], ['manual-weekly-payouts']],
  });

  const resume = useApiMutation({
    mutationFn: (body) => referralsApi.resume(referralId, body),
    successMessage: 'Referral resumed',
    invalidate: [['referrals'], ['manual-weekly-payouts']],
  });

  const remove = useApiMutation({
    mutationFn: () => referralsApi.remove(referralId),
    successMessage: 'Referral deleted',
    invalidate: [['referrals'], ['manual-weekly-payouts']],
    onSuccess: () => onClose(),
  });

  const setField = (key, value) => {
    setEditForm((prev) => ({ ...(prev || form || {}), [key]: value }));
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title="Referral detail"
      description={
        data
          ? `${personLabel(data.referrer, data.referrerListenerUserId)} → ${personLabel(data.referred, data.referredUserId)}`
          : 'Loading…'
      }
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {isLoading && <p className="text-sm text-ink-500">Loading…</p>}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {data && form && (
        <div className="space-y-5">
          {(update.error || revert.error || resume.error || remove.error) && (
            <ErrorState
              error={update.error || revert.error || resume.error || remove.error}
              compact
            />
          )}

          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-ink-500">Status</p>
              <StatusToneBadge status={data.status} />
            </div>
            <div>
              <p className="text-xs text-ink-500">Referral bonus</p>
              <p className="font-medium">₹{fmtNumber(data.referralBonusRupees)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Bonus week (IST)</p>
              <p className="font-mono text-sm font-medium">
                {data.referralBonusWeekStartDate
                  ? `${data.referralBonusWeekStartDate} → ${data.referralBonusWeekEndDate || '—'}`
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Referrer</p>
              <p className="font-medium">
                {personLabel(data.referrer, data.referrerListenerUserId)}
              </p>
              <p className="font-mono text-[11px] text-ink-500">{data.referrerListenerUserId}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Referred</p>
              <p className="font-medium">{personLabel(data.referred, data.referredUserId)}</p>
              <p className="font-mono text-[11px] text-ink-500">{data.referredUserId}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Created</p>
              <p className="text-xs text-ink-700">{fmtDateTime(data.createdAt)}</p>
            </div>
            {data.stoppedAt && (
              <div className="col-span-2">
                <p className="text-xs text-ink-500">Stopped / reverted</p>
                <p className="text-xs text-ink-700">
                  {fmtDateTime(data.stoppedAt)}
                  {data.stopReason ? ` · ${data.stopReason}` : ''}
                </p>
              </div>
            )}
          </div>

          {writable && data.status === 'ACTIVE' && (
            <div className="space-y-3 rounded-lg border border-ink-100 p-4">
              <p className="text-sm font-semibold text-ink-900">Edit referral</p>
              <Field label="Referral bonus (₹)">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.referralBonusRupees}
                  onChange={(e) => setField('referralBonusRupees', e.target.value)}
                />
              </Field>
              <Field label="Note">
                <Textarea
                  rows={2}
                  value={form.note}
                  onChange={(e) => setField('note', e.target.value)}
                />
              </Field>
              <Button
                size="sm"
                loading={update.isPending}
                onClick={() => {
                  const body = { note: form.note.trim() || null };
                  if (form.referralBonusRupees !== '') {
                    body.referralBonusRupees = Number(form.referralBonusRupees);
                  }
                  update.mutate(body);
                }}
              >
                Save changes
              </Button>
            </div>
          )}

          {writable && data.status === 'ACTIVE' && (
            <div className="space-y-3 rounded-lg border border-amber-100 bg-amber-50/40 p-4">
              <p className="text-sm font-semibold text-ink-900">Revert referral</p>
              <p className="text-xs text-ink-600">
                Removes the one-time bonus from live weekly bank payouts (PAID history stays
                frozen). You can resume later if needed.
              </p>
              <Field label="Reason">
                <Input
                  value={stopReason}
                  onChange={(e) => setStopReason(e.target.value)}
                  placeholder="Optional"
                />
              </Field>
              <Button
                size="sm"
                variant="danger"
                loading={revert.isPending}
                onClick={() => {
                  if (!window.confirm('Revert this referral from live bank payouts?')) return;
                  revert.mutate({ stopReason: stopReason.trim() || undefined });
                }}
              >
                Revert
              </Button>
            </div>
          )}

          {writable && data.status === 'STOPPED' && (
            <div className="space-y-3 rounded-lg border border-emerald-100 bg-emerald-50/40 p-4">
              <p className="text-sm font-semibold text-ink-900">Resume referral</p>
              <Button
                size="sm"
                loading={resume.isPending}
                onClick={() => resume.mutate({ resumeWeeks: true })}
              >
                Resume referral
              </Button>
            </div>
          )}

          {writable && (
            <div className="space-y-3 rounded-lg border border-red-100 bg-red-50/40 p-4">
              <p className="text-sm font-semibold text-ink-900">Delete referral</p>
              <p className="text-xs text-ink-600">
                Reverts any live bonus first, then permanently deletes this referral.
              </p>
              <Button
                size="sm"
                variant="danger"
                loading={remove.isPending}
                onClick={() => {
                  if (
                    !window.confirm(
                      'Delete this referral? Amount will be reverted from live payouts, then deleted.',
                    )
                  ) {
                    return;
                  }
                  remove.mutate();
                }}
              >
                Delete
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

export function ReferralsPage() {
  const { can } = useAuth();
  const writable = can(P.REFERRALS_WRITE);
  const table = useTableState(
    {
      status: '',
      search: '',
      referrerListenerUserId: '',
      referredUserId: '',
    },
    { limit: 20 },
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);

  const params = {
    ...table.params,
    status: table.filters.status || undefined,
    search: table.filters.search || undefined,
    referrerListenerUserId: table.filters.referrerListenerUserId || undefined,
    referredUserId: table.filters.referredUserId || undefined,
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.referrals(params),
    queryFn: () => referralsApi.list(params),
  });

  const columns = [
    {
      key: 'referrer',
      header: 'Referrer',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink-900">
            {personLabel(row.referrer, row.referrerListenerUserId)}
          </p>
          <p className="font-mono text-[11px] text-ink-500">{shortId(row.referrerListenerUserId)}</p>
        </div>
      ),
    },
    {
      key: 'referred',
      header: 'Referred',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-ink-800">
            {personLabel(row.referred, row.referredUserId)}
          </p>
          <p className="font-mono text-[11px] text-ink-500">{shortId(row.referredUserId)}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusToneBadge status={row.status} />,
    },
    {
      key: 'bonus',
      header: 'Bonus ₹',
      align: 'right',
      render: (row) => (
        <span className="font-medium text-emerald-700">₹{fmtNumber(row.referralBonusRupees)}</span>
      ),
    },
    {
      key: 'bonusWeek',
      header: 'Bonus week',
      render: (row) => (
        <span className="font-mono text-xs text-ink-700">
          {row.referralBonusWeekStartDate || '—'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-ink-600">{fmtDateTime(row.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <Button size="sm" variant="secondary" onClick={() => setDetailId(row.id)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Referrals"
        description="One-time referral bonuses by IST week. Weekly incentives are managed on the Incentives page."
        actions={
          writable && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Create referral
            </Button>
          )
        }
      />

      <Card bodyClassName="">
        <FilterBar>
          <Field label="Search" className="w-52">
            <Input
              value={table.filters.search}
              placeholder="Name, publicId, note…"
              onChange={(e) => table.setFilter('search', e.target.value)}
            />
          </Field>
          <Field label="Status" className="w-36">
            <Select
              value={table.filters.status}
              onChange={(e) => table.setFilter('status', e.target.value)}
            >
              <option value="">All</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="STOPPED">STOPPED</option>
            </Select>
          </Field>
          <Field label="Referrer user ID" className="w-52">
            <Input
              value={table.filters.referrerListenerUserId}
              placeholder="UUID"
              onChange={(e) => table.setFilter('referrerListenerUserId', e.target.value)}
            />
          </Field>
          <Field label="Referred user ID" className="w-52">
            <Input
              value={table.filters.referredUserId}
              placeholder="UUID"
              onChange={(e) => table.setFilter('referredUserId', e.target.value)}
            />
          </Field>
        </FilterBar>

        <DataTable
          columns={columns}
          rows={data?.data}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          emptyIcon={Handshake}
          emptyTitle="No referrals yet"
          emptyDescription="Create a referral to link a referred user to a listener."
        />
        <Pagination
          meta={data?.meta}
          onPageChange={table.setPage}
          onLimitChange={table.changeLimit}
        />
      </Card>

      {createOpen && (
        <CreateReferralModal open={createOpen} onClose={() => setCreateOpen(false)} />
      )}
      {detailId && (
        <ReferralDetailModal referralId={detailId} onClose={() => setDetailId(null)} />
      )}
    </>
  );
}
