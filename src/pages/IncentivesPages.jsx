import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Download, IndianRupee, Pencil, Plus, X } from 'lucide-react';
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
  Tabs,
  Textarea,
} from '../components/ui';
import { useToast } from '../components/ui/Toast';
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

function currentIstWeekStartHint() {
  const now = new Date();
  const istMs = now.getTime() + 5.5 * 60 * 60 * 1000;
  const ist = new Date(istMs);
  const day = ist.getUTCDay();
  const daysFromMonday = (day + 6) % 7;
  ist.setUTCDate(ist.getUTCDate() - daysFromMonday);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ist.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

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

function ExportButton({ onExport, busy }) {
  return (
    <Button variant="secondary" size="sm" loading={busy} onClick={onExport}>
      <Download className="size-4" />
      Export CSV
    </Button>
  );
}

function WeekChips({ weeks, onRemove }) {
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
          <button
            type="button"
            onClick={() => onRemove(w)}
            className="rounded p-0.5 text-ink-400 hover:bg-ink-200 hover:text-ink-700"
            aria-label={`Remove ${w}`}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

function CreateIncentiveModal({ open, onClose }) {
  const [form, setForm] = useState({
    listenerUserId: '',
    amountRupees: '',
    weekStarts: [currentIstWeekStartHint()],
    weekDate: '',
    weekText: '',
    note: '',
  });
  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const create = useApiMutation({
    mutationFn: (body) => referralsApi.createIncentive(body),
    successMessage: 'Incentive added',
    invalidate: [['referrals'], ['manual-weekly-payouts']],
    onSuccess: () => onClose(),
  });

  const mergeWeeks = (extra) => {
    const parsed = parseWeekStarts(extra);
    if (!parsed.length) return;
    set('weekStarts', [...new Set([...form.weekStarts, ...parsed])].sort());
  };

  const submit = () => {
    const weeks = [
      ...new Set([
        ...form.weekStarts,
        ...parseWeekStarts(form.weekText),
        ...parseWeekStarts(form.weekDate),
      ]),
    ].sort();
    create.mutate({
      listenerUserId: form.listenerUserId.trim(),
      amountRupees: Number(form.amountRupees),
      weekStarts: weeks.length ? weeks : undefined,
      note: form.note.trim() || undefined,
      type: 'INCENTIVE',
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Add incentive"
      description={`Schedule the same ₹ amount for one or more IST weeks (Mon–Sun). Amounts go live in listener money and weekly payout at the next Monday 00:00 IST after each week (not immediately). Current IST week starts ${currentIstWeekStartHint()}.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={create.isPending}>
            Add incentive
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {create.error && <ErrorState error={create.error} compact />}
        <Field label="Listener user ID" required hint="Approved listener UUID">
          <Input
            value={form.listenerUserId}
            placeholder="UUID"
            onChange={(e) => set('listenerUserId', e.target.value)}
          />
        </Field>
        <Field label="Amount (₹)" required hint="Same amount applied to every selected week">
          <Input
            type="number"
            min="0.01"
            step="0.01"
            value={form.amountRupees}
            onChange={(e) => set('amountRupees', e.target.value)}
          />
        </Field>
        <div className="space-y-2">
          <Field label="IST week starts" hint="Pick dates or paste YYYY-MM-DD Mondays">
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

function EditIncentiveModal({ row, open, onClose }) {
  const [form, setForm] = useState({
    amountRupees: row?.amountRupees != null ? String(row.amountRupees) : '',
    note: row?.note || '',
    status: row?.status || 'ACTIVE',
  });
  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const update = useApiMutation({
    mutationFn: (body) => referralsApi.updateIncentive(row.id, body),
    successMessage: 'Incentive updated',
    invalidate: [['referrals'], ['manual-weekly-payouts']],
    onSuccess: () => onClose(),
  });

  const submit = () => {
    const body = {
      amountRupees: Number(form.amountRupees),
      note: form.note.trim() || null,
      status: form.status,
    };
    if (form.status === 'STOPPED' && row.status === 'ACTIVE') {
      body.stopReason = 'Disabled by admin';
    }
    update.mutate(body);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Edit incentive"
      description={
        row?.credited
          ? 'This amount is already live in listener money / weekly payouts. Changes apply immediately.'
          : `Scheduled — goes live ${row?.creditsAt ? fmtDateTime(row.creditsAt) : 'next Monday 00:00 IST'}. Disable before then to prevent credit.`
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={update.isPending}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {update.error && <ErrorState error={update.error} compact />}
        <Field label="Amount (₹)" required>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            value={form.amountRupees}
            onChange={(e) => set('amountRupees', e.target.value)}
          />
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
            <option value="ACTIVE">ACTIVE</option>
            <option value="STOPPED">STOPPED (disabled)</option>
          </Select>
        </Field>
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

/** Admin INCENTIVE grants only (not referrals). */
export function IncentivesPage() {
  const { can } = useAuth();
  const writable = can(P.REFERRALS_WRITE);
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const table = useTableState(
    {
      status: '',
      weekStart: '',
      search: '',
      referrerListenerUserId: '',
    },
    { limit: 20 },
  );

  const params = {
    ...table.params,
    sourceType: 'INCENTIVE',
    status: table.filters.status || undefined,
    weekStart: table.filters.weekStart || undefined,
    search: table.filters.search || undefined,
    referrerListenerUserId: table.filters.referrerListenerUserId || undefined,
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.incentives(params),
    queryFn: () => referralsApi.incentives(params),
  });

  const revert = useApiMutation({
    mutationFn: ({ id, stopReason }) => referralsApi.revertIncentive(id, { stopReason }),
    successMessage: 'Incentive disabled',
    invalidate: [['referrals'], ['manual-weekly-payouts']],
  });

  const remove = useApiMutation({
    mutationFn: (id) => referralsApi.removeIncentive(id),
    successMessage: 'Incentive deleted',
    invalidate: [['referrals'], ['manual-weekly-payouts']],
  });

  const columns = [
    {
      key: 'week',
      header: 'Week',
      render: (row) => (
        <span className="font-mono text-xs text-ink-800">
          {row.weekStartDate} → {row.weekEndDate}
        </span>
      ),
    },
    {
      key: 'listener',
      header: 'Listener',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink-900">
            {personLabel(row.referrer, row.listenerUserId)}
          </p>
          <p className="font-mono text-[11px] text-ink-500">{shortId(row.listenerUserId)}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusToneBadge status={row.status} />,
    },
    {
      key: 'credit',
      header: 'Credit',
      render: (row) => {
        if (row.status === 'STOPPED') {
          return <Badge tone="danger">Won’t credit</Badge>;
        }
        if (row.credited) {
          return <Badge tone="success">Live</Badge>;
        }
        return (
          <div className="min-w-0">
            <Badge tone="neutral">Scheduled</Badge>
            {row.creditsAt && (
              <p className="mt-0.5 whitespace-nowrap text-[11px] text-ink-500">
                {fmtDateTime(row.creditsAt)} IST Mon
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: 'amount',
      header: 'Amount ₹',
      align: 'right',
      render: (row) => (
        <span className="font-medium text-emerald-700">₹{fmtNumber(row.amountRupees)}</span>
      ),
    },
    {
      key: 'note',
      header: 'Note',
      render: (row) => (
        <span className="truncate text-xs text-ink-600">{row.note || '—'}</span>
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
      render: (row) =>
        writable ? (
          <div className="flex flex-wrap justify-end gap-1">
            <Button size="sm" variant="secondary" onClick={() => setEditRow(row)}>
              <Pencil className="size-3.5" />
              Edit
            </Button>
            {row.status === 'ACTIVE' && (
              <Button
                size="sm"
                variant="secondary"
                loading={revert.isPending && revert.variables?.id === row.id}
                onClick={() => {
                  if (
                    !window.confirm(
                      row.credited
                        ? 'Disable this incentive? It will be removed from live listener money and weekly payouts.'
                        : 'Disable this incentive? It will not be credited on the scheduled Monday.',
                    )
                  ) {
                    return;
                  }
                  revert.mutate({ id: row.id });
                }}
              >
                Disable
              </Button>
            )}
            <Button
              size="sm"
              variant="danger"
              loading={remove.isPending && remove.variables === row.id}
              onClick={() => {
                if (
                  !window.confirm(
                    'Delete this incentive? Amount will be removed from live payouts (if already credited), then deleted.',
                  )
                ) {
                  return;
                }
                remove.mutate(row.id);
              }}
            >
              Delete
            </Button>
          </div>
        ) : null,
    },
  ];

  const onExport = async () => {
    setExporting(true);
    try {
      await referralsApi.exportIncentives(params);
      toast.success('Incentives CSV downloaded');
    } catch (err) {
      toast.error(err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Incentives"
        description="Admin incentive amounts by IST week. ACTIVE amounts go live in listener money and weekly payout at the next Monday 00:00 IST after that week (editable/disableable before then). Referrals are managed separately."
        actions={
          <div className="flex flex-wrap gap-2">
            <ExportButton onExport={onExport} busy={exporting} />
            {writable && (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                Add incentive
              </Button>
            )}
          </div>
        }
      />

      <Card bodyClassName="">
        <FilterBar>
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
          <Field label="Week start" className="w-44">
            <Input
              type="date"
              value={table.filters.weekStart}
              onChange={(e) => table.setFilter('weekStart', e.target.value)}
            />
          </Field>
          <Field label="Search" className="w-48">
            <Input
              value={table.filters.search}
              placeholder="Name or publicId…"
              onChange={(e) => table.setFilter('search', e.target.value)}
            />
          </Field>
          <Field label="Listener user ID" className="w-52">
            <Input
              value={table.filters.referrerListenerUserId}
              placeholder="UUID"
              onChange={(e) => table.setFilter('referrerListenerUserId', e.target.value)}
            />
          </Field>
        </FilterBar>

        {(revert.error || remove.error) && (
          <div className="px-5 pt-3">
            <ErrorState error={revert.error || remove.error} compact />
          </div>
        )}

        <DataTable
          columns={columns}
          rows={data?.data}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          emptyIcon={IndianRupee}
          emptyTitle="No incentives"
          emptyDescription="Add an incentive with one or more IST weeks. Amounts credit automatically next Monday 00:00 IST."
        />
        <Pagination
          meta={data?.meta}
          onPageChange={table.setPage}
          onLimitChange={table.changeLimit}
        />
      </Card>

      {createOpen && (
        <CreateIncentiveModal open={createOpen} onClose={() => setCreateOpen(false)} />
      )}
      {editRow && (
        <EditIncentiveModal
          key={editRow.id}
          row={editRow}
          open={Boolean(editRow)}
          onClose={() => setEditRow(null)}
        />
      )}
    </>
  );
}

/** One IST week board: admin INCENTIVE grants + legacy referral incentive weeks. */
export function WeeklyIncentivesPage() {
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const table = useTableState(
    {
      weekStart: '',
      status: '',
      search: '',
      referrerListenerUserId: '',
    },
    { limit: 20 },
  );

  const params = {
    ...table.params,
    weekStart: table.filters.weekStart || undefined,
    status: table.filters.status || undefined,
    search: table.filters.search || undefined,
    referrerListenerUserId: table.filters.referrerListenerUserId || undefined,
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.weeklyIncentiveReport(params),
    queryFn: () => referralsApi.weeklyIncentiveReport(params),
  });

  const summary = data?.summary;
  const week = data?.week;

  const columns = [
    {
      key: 'type',
      header: 'Type',
      render: (row) => (
        <Badge tone={row.sourceType === 'INCENTIVE' ? 'success' : 'brand'}>
          {row.sourceType || 'REFERRAL'}
        </Badge>
      ),
    },
    {
      key: 'week',
      header: 'Week',
      render: (row) => (
        <span className="font-mono text-xs text-ink-800">
          {row.weekStartDate} → {row.weekEndDate}
        </span>
      ),
    },
    {
      key: 'referrer',
      header: 'Listener',
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
      render: (row) =>
        row.sourceType === 'INCENTIVE' || !row.referredUserId ? (
          <span className="text-xs text-ink-400">—</span>
        ) : (
          <p className="truncate text-sm text-ink-800">
            {personLabel(row.referred, row.referredUserId)}
          </p>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusToneBadge status={row.status} />,
    },
    {
      key: 'amount',
      header: 'Amount ₹',
      align: 'right',
      render: (row) => (
        <span className="font-medium text-emerald-700">₹{fmtNumber(row.amountRupees)}</span>
      ),
    },
    {
      key: 'referralBonus',
      header: 'Ref. bonus ₹',
      align: 'right',
      render: (row) => `₹${fmtNumber(row.referralBonusRupees)}`,
    },
  ];

  const onExport = async () => {
    setExporting(true);
    try {
      await referralsApi.exportWeeklyIncentiveReport(params);
      toast.success('Weekly incentive CSV downloaded');
    } catch (err) {
      toast.error(err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Weekly Incentive"
        description="All incentive lines for one IST Mon–Sun week (admin incentives + referral weeks). ACTIVE amounts feed Weekly bank payouts."
        actions={<ExportButton onExport={onExport} busy={exporting} />}
      />

      <Card bodyClassName="">
        <FilterBar>
          <Field label="Week start (IST Monday)" className="w-44">
            <Input
              type="date"
              value={table.filters.weekStart}
              onChange={(e) => table.setFilter('weekStart', e.target.value)}
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
          <Field label="Search" className="w-48">
            <Input
              value={table.filters.search}
              placeholder="Name or publicId…"
              onChange={(e) => table.setFilter('search', e.target.value)}
            />
          </Field>
          <Field label="Listener user ID" className="w-52">
            <Input
              value={table.filters.referrerListenerUserId}
              placeholder="UUID"
              onChange={(e) => table.setFilter('referrerListenerUserId', e.target.value)}
            />
          </Field>
        </FilterBar>

        {(summary || week) && (
          <div className="grid grid-cols-2 gap-3 border-b border-ink-100 px-5 py-3 text-sm sm:grid-cols-4">
            {week && (
              <div>
                <p className="text-xs text-ink-500">Week</p>
                <p className="font-mono text-sm font-medium">
                  {week.weekStartDate} → {week.weekEndDate}
                </p>
              </div>
            )}
            {summary && (
              <>
                <div>
                  <p className="text-xs text-ink-500">Rows</p>
                  <p className="font-medium">{fmtNumber(summary.rows)}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-500">Listeners</p>
                  <p className="font-medium">{fmtNumber(summary.listeners)}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-500">Total incentive</p>
                  <p className="font-semibold">
                    ₹{fmtNumber(summary.totalIncentiveAmountRupees)}
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        <DataTable
          columns={columns}
          rows={data?.data}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          emptyIcon={ClipboardList}
          emptyTitle="No weekly incentives"
          emptyDescription="Pick a week, or add incentives from the Incentive page."
        />
        <Pagination
          meta={data?.meta}
          onPageChange={table.setPage}
          onLimitChange={table.changeLimit}
        />
      </Card>
    </>
  );
}

/** Incentive reports with export (all lines + weekly). */
export function IncentiveReportsPage() {
  const toast = useToast();
  const [tab, setTab] = useState('all');
  const [exporting, setExporting] = useState(false);

  const allTable = useTableState(
    { sourceType: 'ALL', status: '', weekStart: '', search: '', referrerListenerUserId: '' },
    { limit: 20 },
  );
  const weekTable = useTableState(
    { weekStart: '', status: '', search: '', referrerListenerUserId: '' },
    { limit: 20 },
  );

  const allParams = {
    ...allTable.params,
    sourceType: allTable.filters.sourceType || 'ALL',
    status: allTable.filters.status || undefined,
    weekStart: allTable.filters.weekStart || undefined,
    search: allTable.filters.search || undefined,
    referrerListenerUserId: allTable.filters.referrerListenerUserId || undefined,
  };
  const weekParams = {
    ...weekTable.params,
    weekStart: weekTable.filters.weekStart || undefined,
    status: weekTable.filters.status || undefined,
    search: weekTable.filters.search || undefined,
    referrerListenerUserId: weekTable.filters.referrerListenerUserId || undefined,
  };

  const allQuery = useQuery({
    queryKey: qk.incentives(allParams),
    queryFn: () => referralsApi.incentives(allParams),
    enabled: tab === 'all',
  });
  const weekQuery = useQuery({
    queryKey: qk.weeklyIncentiveReport(weekParams),
    queryFn: () => referralsApi.weeklyIncentiveReport(weekParams),
    enabled: tab === 'weekly',
  });

  const onExport = async () => {
    setExporting(true);
    try {
      if (tab === 'all') {
        await referralsApi.exportIncentives(allParams);
        toast.success('Incentive report CSV downloaded');
      } else {
        await referralsApi.exportWeeklyIncentiveReport(weekParams);
        toast.success('Weekly incentive report CSV downloaded');
      }
    } catch (err) {
      toast.error(err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Incentive Report"
        description="Exportable incentive reports. Referral incentives are included as Type REFERRAL."
        actions={<ExportButton onExport={onExport} busy={exporting} />}
      />
      <Tabs
        tabs={[
          { id: 'all', label: 'All incentives' },
          { id: 'weekly', label: 'Weekly incentives' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'all' && (
        <Card bodyClassName="">
          <FilterBar>
            <Field label="Type" className="w-40">
              <Select
                value={allTable.filters.sourceType}
                onChange={(e) => allTable.setFilter('sourceType', e.target.value)}
              >
                <option value="ALL">All</option>
                <option value="REFERRAL">REFERRAL</option>
                <option value="INCENTIVE">INCENTIVE</option>
              </Select>
            </Field>
            <Field label="Status" className="w-36">
              <Select
                value={allTable.filters.status}
                onChange={(e) => allTable.setFilter('status', e.target.value)}
              >
                <option value="">All</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="STOPPED">STOPPED</option>
              </Select>
            </Field>
            <Field label="Week start" className="w-44">
              <Input
                type="date"
                value={allTable.filters.weekStart}
                onChange={(e) => allTable.setFilter('weekStart', e.target.value)}
              />
            </Field>
            <Field label="Search" className="w-48">
              <Input
                value={allTable.filters.search}
                onChange={(e) => allTable.setFilter('search', e.target.value)}
              />
            </Field>
          </FilterBar>
          <DataTable
            columns={[
              {
                key: 'sourceType',
                header: 'Type',
                render: (row) => <Badge tone="brand">{row.sourceType}</Badge>,
              },
              {
                key: 'week',
                header: 'Week',
                render: (row) => (
                  <span className="font-mono text-xs">
                    {row.weekStartDate} → {row.weekEndDate}
                  </span>
                ),
              },
              {
                key: 'listener',
                header: 'Listener',
                render: (row) => personLabel(row.referrer, row.listenerUserId),
              },
              {
                key: 'status',
                header: 'Status',
                render: (row) => <StatusToneBadge status={row.status} />,
              },
              {
                key: 'amount',
                header: 'Amount ₹',
                align: 'right',
                render: (row) => `₹${fmtNumber(row.amountRupees)}`,
              },
            ]}
            rows={allQuery.data?.data}
            loading={allQuery.isLoading}
            error={allQuery.error}
            onRetry={allQuery.refetch}
            emptyIcon={ClipboardList}
            emptyTitle="No incentive rows"
          />
          <Pagination
            meta={allQuery.data?.meta}
            onPageChange={allTable.setPage}
            onLimitChange={allTable.changeLimit}
          />
        </Card>
      )}

      {tab === 'weekly' && (
        <Card bodyClassName="">
          <FilterBar>
            <Field label="Week start" className="w-44">
              <Input
                type="date"
                value={weekTable.filters.weekStart}
                onChange={(e) => weekTable.setFilter('weekStart', e.target.value)}
              />
            </Field>
            <Field label="Status" className="w-36">
              <Select
                value={weekTable.filters.status}
                onChange={(e) => weekTable.setFilter('status', e.target.value)}
              >
                <option value="">All</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="STOPPED">STOPPED</option>
              </Select>
            </Field>
            <Field label="Search" className="w-48">
              <Input
                value={weekTable.filters.search}
                onChange={(e) => weekTable.setFilter('search', e.target.value)}
              />
            </Field>
          </FilterBar>
          <DataTable
            columns={[
              {
                key: 'week',
                header: 'Week',
                render: (row) => (
                  <span className="font-mono text-xs">
                    {row.weekStartDate} → {row.weekEndDate}
                  </span>
                ),
              },
              {
                key: 'listener',
                header: 'Listener',
                render: (row) => personLabel(row.referrer, row.referrerListenerUserId),
              },
              {
                key: 'status',
                header: 'Status',
                render: (row) => <StatusToneBadge status={row.status} />,
              },
              {
                key: 'amount',
                header: 'Amount ₹',
                align: 'right',
                render: (row) => `₹${fmtNumber(row.amountRupees)}`,
              },
            ]}
            rows={weekQuery.data?.data}
            loading={weekQuery.isLoading}
            error={weekQuery.error}
            onRetry={weekQuery.refetch}
            emptyIcon={ClipboardList}
            emptyTitle="No weekly rows"
          />
          <Pagination
            meta={weekQuery.data?.meta}
            onPageChange={weekTable.setPage}
            onLimitChange={weekTable.changeLimit}
          />
        </Card>
      )}
    </>
  );
}
