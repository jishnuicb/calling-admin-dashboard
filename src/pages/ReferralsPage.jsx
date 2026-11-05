import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Handshake, Plus, X } from 'lucide-react';
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
  Toggle,
} from '../components/ui';
import { useTableState } from '../hooks/useTableState';
import { fmtDateTime, fmtNumber, shortId } from '../lib/format';

const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;

const parseWeekStarts = (raw) => {
  if (Array.isArray(raw)) {
    return [...new Set(raw.map((v) => String(v).trim()).filter((v) => WEEK_RE.test(v)))];
  }
  return [
    ...new Set(
      String(raw || '')
        .split(/[\s,]+/)
        .map((v) => v.trim())
        .filter((v) => WEEK_RE.test(v)),
    ),
  ];
};

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

function WeekChips({ weeks, onRemove, disabled }) {
  if (!weeks.length) {
    return <p className="text-xs text-ink-500">No weeks added yet.</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {weeks.map((w) => (
        <span
          key={w}
          className="inline-flex items-center gap-1 rounded-md bg-ink-100 px-2 py-1 font-mono text-xs text-ink-800"
        >
          {w}
          {!disabled && (
            <button
              type="button"
              onClick={() => onRemove(w)}
              className="rounded p-0.5 text-ink-400 hover:bg-ink-200 hover:text-ink-700"
              aria-label={`Remove ${w}`}
            >
              <X className="size-3" />
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

function CreateReferralModal({ open, onClose }) {
  const [form, setForm] = useState({
    referrerListenerUserId: '',
    referredUserId: '',
    incentiveEligible: true,
    weekStarts: [],
    weekDate: '',
    weekText: '',
    incentiveAmountRupees: '',
    referralBonusRupees: '',
    note: '',
  });

  const create = useApiMutation({
    mutationFn: (body) => referralsApi.create(body),
    successMessage: 'Referral created',
    invalidate: [['referrals']],
    onSuccess: () => onClose(),
  });

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const mergeWeeks = (extra) => {
    const parsed = parseWeekStarts(extra);
    if (!parsed.length) return;
    set(
      'weekStarts',
      [...new Set([...form.weekStarts, ...parsed])].sort(),
    );
  };

  const submit = () => {
    const weeks = [
      ...new Set([
        ...form.weekStarts,
        ...parseWeekStarts(form.weekText),
        ...parseWeekStarts(form.weekDate),
      ]),
    ].sort();
    const body = {
      referrerListenerUserId: form.referrerListenerUserId.trim(),
      referredUserId: form.referredUserId.trim(),
      incentiveEligible: Boolean(form.incentiveEligible),
      incentiveWeekStarts: form.incentiveEligible ? weeks : [],
      note: form.note.trim() || undefined,
    };
    if (form.incentiveAmountRupees !== '') {
      body.incentiveAmountRupees = Number(form.incentiveAmountRupees);
    }
    if (form.referralBonusRupees !== '') {
      body.referralBonusRupees = Number(form.referralBonusRupees);
    }
    create.mutate(body);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Create referral"
      description="Link a referred user to an approved listener. Incentive weeks are IST Monday week starts (YYYY-MM-DD)."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={create.isPending}>
            Create referral
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {create.error && <ErrorState error={create.error} compact />}
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

        <Toggle
          checked={form.incentiveEligible}
          onChange={(v) => set('incentiveEligible', v)}
          label="Incentive eligible"
        />

        {form.incentiveEligible && (
          <div className="space-y-2">
            <Field
              label="Incentive week starts"
              hint="Comma-separated YYYY-MM-DD, or pick a date and add"
            >
              <div className="flex flex-wrap gap-2">
                <Input
                  type="date"
                  value={form.weekDate}
                  onChange={(e) => set('weekDate', e.target.value)}
                  className="w-44"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    mergeWeeks(form.weekDate || form.weekText);
                    set('weekDate', '');
                    set('weekText', '');
                  }}
                >
                  Add week
                </Button>
                <Input
                  value={form.weekText}
                  placeholder="or paste: 2026-01-05, 2026-01-12"
                  onChange={(e) => set('weekText', e.target.value)}
                  className="min-w-[12rem] flex-1"
                />
              </div>
            </Field>
            <WeekChips
              weeks={form.weekStarts}
              onRemove={(w) =>
                set(
                  'weekStarts',
                  form.weekStarts.filter((x) => x !== w),
                )
              }
            />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Weekly incentive (₹)" hint="Blank = default from Referral Bonus settings">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.incentiveAmountRupees}
              onChange={(e) => set('incentiveAmountRupees', e.target.value)}
            />
          </Field>
          <Field label="Referral bonus (₹)" hint="One-time; blank = default">
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

function EditWeekModal({ referralId, week, onClose }) {
  const [amountRupees, setAmountRupees] = useState(
    week.amountRupees != null ? String(week.amountRupees) : '',
  );
  const [note, setNote] = useState(week.note || '');
  const [status, setStatus] = useState(week.status || 'ACTIVE');
  const [stopReason, setStopReason] = useState(week.stopReason || '');

  const save = useApiMutation({
    mutationFn: (body) => referralsApi.updateIncentiveWeek(referralId, week.id, body),
    successMessage: 'Incentive week updated',
    invalidate: [['referrals']],
    onSuccess: () => onClose(),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit week ${week.weekStartDate}`}
      description={`${week.weekStartDate} → ${week.weekEndDate}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={save.isPending}
            onClick={() =>
              save.mutate({
                amountRupees: amountRupees === '' ? undefined : Number(amountRupees),
                note: note.trim() || null,
                status,
                stopReason: status === 'STOPPED' ? stopReason.trim() || undefined : undefined,
              })
            }
          >
            Save week
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {save.error && <ErrorState error={save.error} compact />}
        <Field label="Amount (₹)">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={amountRupees}
            onChange={(e) => setAmountRupees(e.target.value)}
          />
        </Field>
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ACTIVE">ACTIVE</option>
            <option value="STOPPED">STOPPED</option>
          </Select>
        </Field>
        {status === 'STOPPED' && (
          <Field label="Stop reason">
            <Input value={stopReason} onChange={(e) => setStopReason(e.target.value)} />
          </Field>
        )}
        <Field label="Note">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
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
  const [stopWeeks, setStopWeeks] = useState(true);
  const [resumeWeeks, setResumeWeeks] = useState(true);
  const [addWeeksDraft, setAddWeeksDraft] = useState('');
  const [addWeeksAmount, setAddWeeksAmount] = useState('');
  const [editWeek, setEditWeek] = useState(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.referral(referralId),
    queryFn: () => referralsApi.get(referralId),
    enabled: Boolean(referralId),
  });

  const seeded = useMemo(() => {
    if (!data || editForm) return editForm;
    return {
      note: data.note || '',
      incentiveEligible: Boolean(data.incentiveEligible),
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

  const stop = useApiMutation({
    mutationFn: (body) => referralsApi.stop(referralId, body),
    successMessage: 'Referral stopped',
    invalidate: [['referrals']],
  });

  const resume = useApiMutation({
    mutationFn: (body) => referralsApi.resume(referralId, body),
    successMessage: 'Referral resumed',
    invalidate: [['referrals']],
  });

  const addWeeks = useApiMutation({
    mutationFn: (body) => referralsApi.addIncentiveWeeks(referralId, body),
    successMessage: 'Incentive weeks added',
    invalidate: [['referrals']],
    onSuccess: () => {
      setAddWeeksDraft('');
      setAddWeeksAmount('');
    },
  });

  const setField = (key, value) => {
    setEditForm((prev) => ({ ...(prev || form || {}), [key]: value }));
  };

  return (
    <>
      <Modal
        open
        onClose={onClose}
        size="xl"
        title="Referral detail"
        description={data ? `${personLabel(data.referrer, data.referrerListenerUserId)} → ${personLabel(data.referred, data.referredUserId)}` : 'Loading…'}
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
            {(update.error || stop.error || resume.error || addWeeks.error) && (
              <ErrorState
                error={update.error || stop.error || resume.error || addWeeks.error}
                compact
              />
            )}

            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs text-ink-500">Status</p>
                <StatusToneBadge status={data.status} />
              </div>
              <div>
                <p className="text-xs text-ink-500">Incentive eligible</p>
                <p className="font-medium">{data.incentiveEligible ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <p className="text-xs text-ink-500">Referral bonus</p>
                <p className="font-medium">₹{fmtNumber(data.referralBonusRupees)}</p>
              </div>
              <div>
                <p className="text-xs text-ink-500">Referrer</p>
                <p className="font-medium">{personLabel(data.referrer, data.referrerListenerUserId)}</p>
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
                  <p className="text-xs text-ink-500">Stopped</p>
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
                <Toggle
                  checked={Boolean(form.incentiveEligible)}
                  onChange={(v) => setField('incentiveEligible', v)}
                  label="Incentive eligible"
                />
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
                    const body = {
                      note: form.note.trim() || null,
                      incentiveEligible: Boolean(form.incentiveEligible),
                    };
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
              <div className="space-y-3 rounded-lg border border-red-100 bg-red-50/40 p-4">
                <p className="text-sm font-semibold text-ink-900">Stop referral</p>
                <Field label="Stop reason">
                  <Input
                    value={stopReason}
                    onChange={(e) => setStopReason(e.target.value)}
                    placeholder="Optional"
                  />
                </Field>
                <Toggle
                  checked={stopWeeks}
                  onChange={setStopWeeks}
                  label="Also stop ACTIVE incentive weeks"
                />
                <Button
                  size="sm"
                  variant="danger"
                  loading={stop.isPending}
                  onClick={() => {
                    if (!window.confirm('Stop this referral? You can resume it later.')) {
                      return;
                    }
                    stop.mutate({
                      stopReason: stopReason.trim() || undefined,
                      stopWeeks,
                    });
                  }}
                >
                  Stop referral
                </Button>
              </div>
            )}

            {writable && data.status === 'STOPPED' && (
              <div className="space-y-3 rounded-lg border border-emerald-100 bg-emerald-50/40 p-4">
                <p className="text-sm font-semibold text-ink-900">Resume referral</p>
                <p className="text-xs text-ink-600">
                  Sets the referral back to ACTIVE so its weeks can count in Weekly bank payouts
                  again.
                </p>
                <Toggle
                  checked={resumeWeeks}
                  onChange={setResumeWeeks}
                  label="Also resume STOPPED incentive weeks"
                />
                <Button
                  size="sm"
                  loading={resume.isPending}
                  onClick={() => {
                    resume.mutate({ resumeWeeks });
                  }}
                >
                  Resume referral
                </Button>
              </div>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase text-ink-500">
                  Incentive weeks ({data.incentiveWeeks?.length || 0})
                </p>
              </div>
              <ul className="max-h-56 space-y-1.5 overflow-y-auto text-xs">
                {(data.incentiveWeeks || []).length === 0 && (
                  <li className="text-ink-500">No incentive weeks.</li>
                )}
                {(data.incentiveWeeks || []).map((w) => (
                  <li
                    key={w.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded bg-ink-50 px-2.5 py-2"
                  >
                    <div>
                      <p className="font-mono text-ink-800">
                        {w.weekStartDate} → {w.weekEndDate}
                      </p>
                      {w.note && <p className="text-ink-500">{w.note}</p>}
                    </div>
                    <StatusToneBadge status={w.status} />
                    <span className="font-medium">₹{fmtNumber(w.amountRupees)}</span>
                    {writable && (
                      <Button size="sm" variant="ghost" onClick={() => setEditWeek(w)}>
                        Edit
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {writable && data.status === 'ACTIVE' && (
              <div className="space-y-3 rounded-lg border border-ink-100 p-4">
                <p className="text-sm font-semibold text-ink-900">Add incentive weeks</p>
                <Field label="Week starts" hint="Comma-separated YYYY-MM-DD or date picker">
                  <div className="flex flex-wrap gap-2">
                    <Input
                      type="date"
                      value={WEEK_RE.test(addWeeksDraft) ? addWeeksDraft : ''}
                      onChange={(e) => setAddWeeksDraft(e.target.value)}
                      className="w-44"
                    />
                    <Input
                      value={addWeeksDraft}
                      placeholder="2026-01-05, 2026-01-12"
                      onChange={(e) => setAddWeeksDraft(e.target.value)}
                      className="min-w-[12rem] flex-1"
                    />
                  </div>
                </Field>
                <Field label="Amount (₹)" hint="Blank = default">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={addWeeksAmount}
                    onChange={(e) => setAddWeeksAmount(e.target.value)}
                  />
                </Field>
                <Button
                  size="sm"
                  loading={addWeeks.isPending}
                  onClick={() => {
                    const weekStarts = parseWeekStarts(addWeeksDraft);
                    if (!weekStarts.length) return;
                    const body = { weekStarts };
                    if (addWeeksAmount !== '') body.amountRupees = Number(addWeeksAmount);
                    addWeeks.mutate(body);
                  }}
                >
                  Add weeks
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {editWeek && (
        <EditWeekModal
          referralId={referralId}
          week={editWeek}
          onClose={() => setEditWeek(null)}
        />
      )}
    </>
  );
}

export function ReferralsPage() {
  const { can } = useAuth();
  const writable = can(P.REFERRALS_WRITE);
  const table = useTableState(
    {
      status: '',
      incentiveEligible: '',
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
    incentiveEligible:
      table.filters.incentiveEligible === ''
        ? undefined
        : table.filters.incentiveEligible === 'true',
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
      key: 'eligible',
      header: 'Incentive',
      render: (row) => (
        <Badge tone={row.incentiveEligible ? 'info' : 'neutral'}>
          {row.incentiveEligible ? 'Eligible' : 'No'}
        </Badge>
      ),
    },
    {
      key: 'bonus',
      header: 'Bonus',
      align: 'right',
      render: (row) => (
        <span className="font-medium text-emerald-700">₹{fmtNumber(row.referralBonusRupees)}</span>
      ),
    },
    {
      key: 'weeks',
      header: 'Weeks',
      align: 'right',
      render: (row) => (
        <span className="text-sm text-ink-700">
          {fmtNumber(row.activeIncentiveWeekCount ?? 0)}
          <span className="text-ink-400"> / {fmtNumber(row.incentiveWeekCount ?? 0)}</span>
        </span>
      ),
    },
    {
      key: 'activeAmt',
      header: 'Active ₹',
      align: 'right',
      render: (row) =>
        row.activeIncentiveAmountRupees != null ? (
          <span className="font-medium">₹{fmtNumber(row.activeIncentiveAmountRupees)}</span>
        ) : (
          '—'
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
        description="Listener referrals and weekly incentives. Amounts are in rupees (₹)."
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
          <Field label="Incentive eligible" className="w-40">
            <Select
              value={table.filters.incentiveEligible}
              onChange={(e) => table.setFilter('incentiveEligible', e.target.value)}
            >
              <option value="">All</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
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
