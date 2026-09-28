import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { manualWeeklyPayoutsApi } from '../api/endpoints';
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
  Select,
  StatusBadge,
  Textarea,
} from '../components/ui';
import { useTableState } from '../hooks/useTableState';
import { fmtDateTime, fmtPaise, shortId } from '../lib/format';
import { useToast } from '../components/ui/Toast';

function fmtDurationSafe(seconds) {
  const s = Math.max(0, Math.trunc(seconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m ? `${m}m ${r}s` : `${r}s`;
}

function rupeesInputToPaise(value) {
  const n = Number(String(value || '').trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function paiseToRupeesInput(paise) {
  return Number((Number(paise || 0) / 100).toFixed(2));
}

function BankCell({ bankDetails }) {
  if (!bankDetails?.provided) {
    return <span className="text-xs text-ink-400">No bank</span>;
  }
  return (
    <div className="min-w-0 text-xs">
      <p className="truncate font-medium text-ink-800">{bankDetails.accountHolderName || '—'}</p>
      <p className="font-mono text-ink-600">{bankDetails.bankAccountNumberMasked || '—'}</p>
      <p className="font-mono text-ink-500">
        {bankDetails.ifscCodeMasked || '—'}
        {bankDetails.bankName ? ` · ${bankDetails.bankName}` : ''}
      </p>
    </div>
  );
}

function DownloadExportModal({ open, onClose, scope, filters }) {
  const toast = useToast();
  const [format, setFormat] = useState('csv');
  const [decryptionKey, setDecryptionKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await manualWeeklyPayoutsApi.export({
        scope,
        format,
        decryptionKey: decryptionKey.trim() || undefined,
        ...filters,
      });
      toast.success(
        decryptionKey.trim()
          ? 'Downloaded with unmasked bank details'
          : 'Downloaded (bank details masked)',
      );
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Download payouts"
      description="Uses the filters currently applied on this tab. Leave decryption key empty for masked account/IFSC; enter the permanent key to unmask."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={run} loading={busy}>
            <Download className="size-4" />
            Download
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <ErrorState error={error} compact />}
        <Field label="Format">
          <Select value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="csv">CSV</option>
            <option value="xlsx">XLSX (Excel)</option>
          </Select>
        </Field>
        <Field label="Decryption key (optional)">
          <Input
            type="password"
            autoComplete="off"
            value={decryptionKey}
            onChange={(e) => setDecryptionKey(e.target.value)}
            placeholder="Permanent key to unmask bank account & IFSC"
          />
        </Field>
      </div>
    </Modal>
  );
}

function WeekDetailModal({ listenerUserId, weekStart, onClose }) {
  const canWrite = useAuth().can(P.PAYOUTS_WRITE);
  const [extraRupees, setExtraRupees] = useState('');
  const [note, setNote] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.manualWeeklyDetail(listenerUserId, weekStart),
    queryFn: () => manualWeeklyPayoutsApi.detail(listenerUserId, { weekStart }),
    enabled: Boolean(listenerUserId && weekStart),
  });

  useEffect(() => {
    if (!data) return;
    setExtraRupees(String(paiseToRupeesInput(data.extraAmountPaise)));
    setNote(data.note || '');
  }, [data?.id, data?.extraAmountPaise, data?.note, data?.status, listenerUserId, weekStart]);

  const invalidate = [
    ['manual-weekly-payouts'],
    ['earnings'],
    qk.manualWeeklyDetail(listenerUserId, weekStart),
  ];

  const update = useApiMutation({
    mutationFn: () => {
      const extraAmountPaise = rupeesInputToPaise(extraRupees);
      if (extraAmountPaise === null) throw new Error('Extra amount must be a non-negative number');
      return manualWeeklyPayoutsApi.update(listenerUserId, {
        weekStart,
        extraAmountPaise,
        note: note.trim() || null,
      });
    },
    successMessage: 'Settlement updated',
    invalidate,
  });

  const markPaid = useApiMutation({
    mutationFn: () => {
      const extraAmountPaise = rupeesInputToPaise(extraRupees);
      if (extraAmountPaise === null) throw new Error('Extra amount must be a non-negative number');
      return manualWeeklyPayoutsApi.markPaid(listenerUserId, {
        weekStart,
        extraAmountPaise,
        note: note.trim() || null,
      });
    },
    successMessage: 'Marked paid',
    invalidate,
  });

  const unpaid = data?.status !== 'PAID';
  const name =
    data?.listener?.displayName || data?.listener?.name || shortId(listenerUserId);

  return (
    <Modal
      open={Boolean(listenerUserId && weekStart)}
      onClose={onClose}
      title={data ? name : 'Weekly settlement'}
      description={
        data
          ? `${data.weekStartDate} → ${data.weekEndDate} · ${fmtPaise(data.totalAmountPaise)}`
          : undefined
      }
      size="lg"
      footer={
        <>
          {canWrite && unpaid && data && (
            <>
              <Button
                variant="secondary"
                onClick={() => update.mutate()}
                loading={update.isPending}
              >
                Save extra / note
              </Button>
              <Button onClick={() => markPaid.mutate()} loading={markPaid.isPending}>
                Mark paid
              </Button>
            </>
          )}
          {canWrite && !unpaid && data && (
            <Button
              variant="secondary"
              onClick={() => markPaid.mutate()}
              loading={markPaid.isPending}
            >
              Sync listener paid status
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      {isLoading && <p className="text-sm text-ink-500">Loading…</p>}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {(update.error || markPaid.error) && (
        <ErrorState error={update.error || markPaid.error} compact />
      )}
      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-ink-500">Status</p>
              <StatusBadge status={data.status} />
            </div>
            <div>
              <p className="text-xs text-ink-500">Call amount</p>
              <p className="font-medium">{fmtPaise(data.callAmountPaise)}</p>
              <p className="text-[11px] text-ink-500">{data.callCount} calls</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Bonus amount</p>
              <p className="font-medium">{fmtPaise(data.bonusAmountPaise)}</p>
              <p className="text-[11px] text-ink-500">{data.bonusCount} bonuses</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Extra</p>
              <p className="font-medium">{fmtPaise(data.extraAmountPaise)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Total</p>
              <p className="font-semibold">{fmtPaise(data.totalAmountPaise)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Mobile</p>
              <p className="font-mono text-xs">{data.listener?.mobile || '—'}</p>
            </div>
            <div className="col-span-2 sm:col-span-3">
              <p className="text-xs text-ink-500">Bank (masked)</p>
              <BankCell bankDetails={data.bankDetails} />
            </div>
            {data.paidAt && (
              <div className="col-span-2">
                <p className="text-xs text-ink-500">Paid at</p>
                <p>{fmtDateTime(data.paidAt)}</p>
              </div>
            )}
          </div>

          {unpaid && canWrite && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Extra amount (₹)">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={extraRupees}
                  onChange={(e) => setExtraRupees(e.target.value)}
                />
              </Field>
              <Field label="Note">
                <Textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Bank transfer reference, UTR, etc."
                />
              </Field>
            </div>
          )}

          {!unpaid && data.note && (
            <div>
              <p className="text-xs text-ink-500">Note</p>
              <p className="text-sm">{data.note}</p>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-ink-500">
              Calls included ({data.calls?.length || 0})
            </p>
            <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
              {(data.calls || []).length === 0 && (
                <li className="text-ink-500">No call earnings this week.</li>
              )}
              {(data.calls || []).map((e) => (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded bg-ink-50 px-2 py-1.5"
                >
                  {e.callSessionId ? (
                    <Link
                      to={`/calls/${e.callSessionId}`}
                      className="font-mono text-brand-700 hover:underline"
                    >
                      {shortId(e.callSessionId)}
                    </Link>
                  ) : (
                    <span className="font-mono">{shortId(e.id)}</span>
                  )}
                  <StatusBadge status={e.status} />
                  <span>{fmtDurationSafe(e.durationSeconds)}</span>
                  <span className="text-ink-500">{fmtDateTime(e.createdAt)}</span>
                  <span className="font-medium">{fmtPaise(e.amountPaise)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-ink-500">
              Bonuses included ({data.bonuses?.length || 0})
            </p>
            <ul className="max-h-36 space-y-1 overflow-y-auto text-xs">
              {(data.bonuses || []).length === 0 && (
                <li className="text-ink-500">No weekly bonus this week.</li>
              )}
              {(data.bonuses || []).map((e) => (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded bg-ink-50 px-2 py-1.5"
                >
                  <span className="font-mono">{shortId(e.id)}</span>
                  <StatusBadge status={e.status} />
                  <span className="text-ink-500">{e.referenceId || 'WEEKLY_BONUS'}</span>
                  <span className="text-ink-500">{fmtDateTime(e.createdAt)}</span>
                  <span className="font-medium">{fmtPaise(e.amountPaise)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Modal>
  );
}

function WeekSheetTab() {
  const { can } = useAuth();
  const canWrite = can(P.PAYOUTS_WRITE);
  const [detail, setDetail] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);

  const weeksQuery = useQuery({
    queryKey: qk.manualWeeklyWeeks({ count: 5 }),
    queryFn: () => manualWeeklyPayoutsApi.weeks({ count: 5 }),
  });

  const weeks = weeksQuery.data?.weeks || [];
  const defaultWeek = weeks[0]?.weekStartDate || '';

  const table = useTableState({
    weekStart: '',
    status: '',
    search: '',
  });

  const weekStart = table.filters.weekStart || defaultWeek;

  const listParams = useMemo(
    () => ({
      ...table.params,
      weekStart: weekStart || undefined,
      status: table.filters.status || undefined,
      search: table.filters.search || undefined,
    }),
    [table.params, table.filters.status, table.filters.search, weekStart],
  );

  const exportFilters = useMemo(
    () => ({
      weekStart: weekStart || undefined,
      status: table.filters.status || undefined,
      search: table.filters.search || undefined,
    }),
    [weekStart, table.filters.status, table.filters.search],
  );

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.manualWeeklyList(listParams),
    queryFn: () => manualWeeklyPayoutsApi.list(listParams),
    enabled: Boolean(weekStart),
  });

  const summary = data?.summary;

  const columns = [
    {
      key: 'listener',
      header: 'Listener',
      render: (row) => (
        <div className="min-w-0">
          <button
            type="button"
            onClick={() =>
              setDetail({ listenerUserId: row.listenerUserId, weekStart: row.weekStartDate })
            }
            className="truncate text-left text-sm font-medium text-brand-700 hover:underline"
          >
            {row.listener?.displayName || row.listener?.name || shortId(row.listenerUserId)}
          </button>
          <p className="font-mono text-[11px] text-ink-500">{row.listener?.mobile || '—'}</p>
        </div>
      ),
    },
    {
      key: 'bank',
      header: 'Bank (masked)',
      render: (row) => <BankCell bankDetails={row.bankDetails} />,
    },
    {
      key: 'call',
      header: 'Call amount',
      align: 'right',
      render: (row) => (
        <div className="text-right">
          <p className="font-medium">{fmtPaise(row.callAmountPaise)}</p>
          <p className="text-[11px] text-ink-500">{row.callCount} calls</p>
        </div>
      ),
    },
    {
      key: 'bonus',
      header: 'Bonus',
      align: 'right',
      render: (row) => fmtPaise(row.bonusAmountPaise),
    },
    {
      key: 'extra',
      header: 'Extra',
      align: 'right',
      render: (row) => fmtPaise(row.extraAmountPaise),
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: (row) => <span className="font-semibold">{fmtPaise(row.totalAmountPaise)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            setDetail({ listenerUserId: row.listenerUserId, weekStart: row.weekStartDate })
          }
        >
          {canWrite && row.status !== 'PAID' ? 'Settle' : 'View'}
        </Button>
      ),
    },
  ];

  return (
    <>
      <Card>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <FilterBar>
            <Field label="Week (last 5)">
              <Select
                value={table.filters.weekStart || defaultWeek}
                onChange={(e) => table.setFilter('weekStart', e.target.value)}
              >
                {weeks.map((w) => (
                  <option key={w.weekStartDate} value={w.weekStartDate}>
                    {w.label}
                    {w.isCurrent ? ' (current)' : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select
                value={table.filters.status}
                onChange={(e) => table.setFilter('status', e.target.value)}
              >
                <option value="">All</option>
                <option value="UNPAID">Unpaid</option>
                <option value="PAID">Paid</option>
              </Select>
            </Field>
            <Field label="Search">
              <Input
                value={table.filters.search}
                onChange={(e) => table.setFilter('search', e.target.value)}
                placeholder="Name, mobile, user id"
              />
            </Field>
          </FilterBar>
          <Button variant="secondary" onClick={() => setExportOpen(true)} disabled={!weekStart}>
            <Download className="size-4" />
            Download
          </Button>
        </div>

        {summary && (
          <div className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:grid-cols-6">
            <div>
              <p className="text-xs text-ink-500">Listeners</p>
              <p className="font-medium">{summary.listeners}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Unpaid / Paid</p>
              <p className="font-medium">
                {summary.unpaidCount} / {summary.paidCount}
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Call total</p>
              <p className="font-medium">{fmtPaise(summary.totalCallAmountPaise)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Bonus total</p>
              <p className="font-medium">{fmtPaise(summary.totalBonusAmountPaise)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Extra total</p>
              <p className="font-medium">{fmtPaise(summary.totalExtraAmountPaise)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Grand total</p>
              <p className="font-semibold">{fmtPaise(summary.totalAmountPaise)}</p>
            </div>
          </div>
        )}

        {weeksQuery.error && <ErrorState error={weeksQuery.error} onRetry={weeksQuery.refetch} />}
        {error && <ErrorState error={error} onRetry={refetch} />}

        <DataTable columns={columns} rows={data?.data || []} loading={isLoading || !weekStart} />
        <Pagination meta={data?.meta} page={table.page} onPageChange={table.setPage} />
      </Card>

      {detail && (
        <WeekDetailModal
          listenerUserId={detail.listenerUserId}
          weekStart={detail.weekStart}
          onClose={() => setDetail(null)}
        />
      )}
      {exportOpen && (
        <DownloadExportModal
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          scope="week"
          filters={exportFilters}
        />
      )}
    </>
  );
}

function HistoryTab() {
  const [detail, setDetail] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);

  const weeksQuery = useQuery({
    queryKey: qk.manualWeeklyWeeks({ count: 5 }),
    queryFn: () => manualWeeklyPayoutsApi.weeks({ count: 5 }),
  });
  const weeks = weeksQuery.data?.weeks || [];

  const table = useTableState({
    weekStart: '',
    from: '',
    to: '',
    search: '',
  });

  const listParams = useMemo(
    () => ({
      ...table.params,
      weekStart: table.filters.weekStart || undefined,
      from: table.filters.from || undefined,
      to: table.filters.to || undefined,
      search: table.filters.search || undefined,
    }),
    [table.params, table.filters],
  );

  const exportFilters = useMemo(
    () => ({
      weekStart: table.filters.weekStart || undefined,
      from: table.filters.from || undefined,
      to: table.filters.to || undefined,
      search: table.filters.search || undefined,
    }),
    [table.filters],
  );

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.manualWeeklyHistory(listParams),
    queryFn: () => manualWeeklyPayoutsApi.history(listParams),
  });

  const columns = [
    {
      key: 'week',
      header: 'Week',
      render: (row) => (
        <span className="text-xs">
          {row.weekStartDate} → {row.weekEndDate}
        </span>
      ),
    },
    {
      key: 'listener',
      header: 'Listener',
      render: (row) => (
        <div className="min-w-0">
          <button
            type="button"
            onClick={() =>
              setDetail({ listenerUserId: row.listenerUserId, weekStart: row.weekStartDate })
            }
            className="truncate text-left text-sm font-medium text-brand-700 hover:underline"
          >
            {row.listener?.displayName || row.listener?.name || shortId(row.listenerUserId)}
          </button>
          <p className="font-mono text-[11px] text-ink-500">{row.listener?.mobile || '—'}</p>
        </div>
      ),
    },
    {
      key: 'bank',
      header: 'Bank (masked)',
      render: (row) => <BankCell bankDetails={row.bankDetails} />,
    },
    {
      key: 'call',
      header: 'Call',
      align: 'right',
      render: (row) => fmtPaise(row.callAmountPaise),
    },
    {
      key: 'bonus',
      header: 'Bonus',
      align: 'right',
      render: (row) => fmtPaise(row.bonusAmountPaise),
    },
    {
      key: 'extra',
      header: 'Extra',
      align: 'right',
      render: (row) => fmtPaise(row.extraAmountPaise),
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: (row) => <span className="font-semibold">{fmtPaise(row.totalAmountPaise)}</span>,
    },
    {
      key: 'paidAt',
      header: 'Paid at',
      render: (row) => <span className="text-xs text-ink-600">{fmtDateTime(row.paidAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            setDetail({ listenerUserId: row.listenerUserId, weekStart: row.weekStartDate })
          }
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <>
      <Card>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <FilterBar>
            <Field label="Week">
              <Select
                value={table.filters.weekStart}
                onChange={(e) => table.setFilter('weekStart', e.target.value)}
              >
                <option value="">All weeks</option>
                {weeks.map((w) => (
                  <option key={w.weekStartDate} value={w.weekStartDate}>
                    {w.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Paid from">
              <Input
                type="date"
                value={table.filters.from}
                onChange={(e) => table.setFilter('from', e.target.value)}
              />
            </Field>
            <Field label="Paid to">
              <Input
                type="date"
                value={table.filters.to}
                onChange={(e) => table.setFilter('to', e.target.value)}
              />
            </Field>
            <Field label="Search">
              <Input
                value={table.filters.search}
                onChange={(e) => table.setFilter('search', e.target.value)}
                placeholder="Name, mobile"
              />
            </Field>
          </FilterBar>
          <Button variant="secondary" onClick={() => setExportOpen(true)}>
            <Download className="size-4" />
            Download
          </Button>
        </div>

        {error && <ErrorState error={error} onRetry={refetch} />}
        <DataTable columns={columns} rows={data?.data || []} loading={isLoading} />
        <Pagination meta={data?.meta} page={table.page} onPageChange={table.setPage} />
      </Card>

      {detail && (
        <WeekDetailModal
          listenerUserId={detail.listenerUserId}
          weekStart={detail.weekStart}
          onClose={() => setDetail(null)}
        />
      )}
      {exportOpen && (
        <DownloadExportModal
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          scope="history"
          filters={exportFilters}
        />
      )}
    </>
  );
}

export function ManualWeeklyPayoutsPage() {
  const [tab, setTab] = useState('week');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Weekly bank payouts"
        description="Offline weekly settlements (bank transfer). Call + bonus from earnings; add extra; mark paid. Separate from Cashfree payouts."
      />

      <div className="flex gap-2">
        <Button
          variant={tab === 'week' ? 'primary' : 'secondary'}
          onClick={() => setTab('week')}
        >
          Week sheet
        </Button>
        <Button
          variant={tab === 'history' ? 'primary' : 'secondary'}
          onClick={() => setTab('history')}
        >
          Paid history
        </Button>
      </div>

      {tab === 'week' ? <WeekSheetTab /> : <HistoryTab />}
    </div>
  );
}

export default ManualWeeklyPayoutsPage;
