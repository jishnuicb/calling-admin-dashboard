import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { KeyRound, LockOpen, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { configApi, otpApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
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
  SearchInput,
  Select,
} from '../components/ui';
import { useApiMutation } from '../hooks/useApiMutation';
import { useTableState } from '../hooks/useTableState';
import { useAuth } from '../auth/AuthContext';
import { P } from '../auth/permissions';
import { fmtDateTime, fmtRelative } from '../lib/format';
import { searchWorldCountries } from '../data/worldCountries';

/**
 * The three thresholds that drive the resend policy, stored as SystemConfig rows
 * so they can be tuned without a deployment.
 *
 * They are edited here as well as on the Configuration screen because this is
 * where an admin is standing when they realise the limits are wrong — the queue
 * of locked numbers is the symptom that sends them looking for the setting.
 */
const POLICY_FIELDS = [
  {
    key: 'otp.resendDelayAfterFirstSeconds',
    policyField: 'resendDelayAfterFirstSeconds',
    label: 'Wait after the 1st code',
    unit: 'seconds',
    note: 'The first code is always sent immediately. This is how long the user waits before they may request a second.',
  },
  {
    key: 'otp.resendDelayAfterSecondSeconds',
    policyField: 'resendDelayAfterSecondSeconds',
    label: 'Wait after the 2nd code',
    unit: 'seconds',
    note: 'Applies to the third and any later request, so raising the attempt limit still throttles.',
  },
  {
    key: 'otp.maxRequestsBeforeLock',
    policyField: 'maxRequestsBeforeLock',
    label: 'Requests before lock',
    unit: 'codes',
    note: 'Once this many codes have been sent the number is locked. Lowering it does not retroactively lock numbers, but the next request from a number already at or above the new limit will lock it.',
  },
];

function EditPolicyModal({ field, currentValue, onClose }) {
  const [value, setValue] = useState(currentValue ?? '');

  const mutation = useApiMutation({
    mutationFn: () => configApi.set({ key: field.key, value: Number(value) }),
    successMessage: `${field.label} updated`,
    // The policy is echoed by the summary endpoint and by /auth/otp/send, so
    // refresh both the config screen's cache and this page's.
    invalidate: [['otp'], ['config']],
    onSuccess: onClose,
  });

  const changed = String(value) !== String(currentValue ?? '');

  return (
    <Modal
      open
      onClose={onClose}
      title={field.label}
      description={field.key}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={!changed}>
            Save setting
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {mutation.error && <ErrorState error={mutation.error} compact />}

        <Field label="Value" required hint={field.unit}>
          <Input
            autoFocus
            type="number"
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </Field>

        <p className="rounded-lg bg-brand-50 px-3.5 py-2.5 text-xs text-brand-900">{field.note}</p>

        <p className="text-xs text-ink-500">
          Runtime settings are cached in-process for a few seconds, so the new value can take a
          moment to apply on every server instance.
        </p>
      </div>
    </Modal>
  );
}

function UnlockModal({ row, onClose }) {
  const mutation = useApiMutation({
    mutationFn: () => otpApi.unlock(row.id),
    successMessage: `${row.mobile} unlocked`,
    invalidate: [['otp']],
    onSuccess: onClose,
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Unlock ${row.mobile}?`}
      description="Clears the lock and resets the request counter, so the next code is sent immediately."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>
            <LockOpen className="size-4" />
            Unlock number
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {mutation.error && <ErrorState error={mutation.error} compact />}

        <dl className="rounded-lg bg-ink-50 px-3.5 py-3 text-sm">
          <div className="flex justify-between gap-4 py-0.5">
            <dt className="text-ink-500">Codes requested</dt>
            <dd className="tabular font-medium text-ink-900">{row.requestCount}</dd>
          </div>
          <div className="flex justify-between gap-4 py-0.5">
            <dt className="text-ink-500">Locked</dt>
            <dd className="font-medium text-ink-900">{fmtDateTime(row.lockedAt)}</dd>
          </div>
          <div className="flex justify-between gap-4 py-0.5">
            <dt className="text-ink-500">Previous unlocks</dt>
            <dd className="tabular font-medium text-ink-900">{row.unlockCount}</dd>
          </div>
        </dl>

        {row.unlockCount > 0 && (
          <p className="rounded-lg bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
            This number has been unlocked {row.unlockCount} time(s) before. Repeated lockouts on the
            same number can mean an enumeration attempt rather than a user who mistyped their
            number — check the audit log before unlocking again.
          </p>
        )}

        <p className="text-xs text-ink-500">
          Recorded in the audit log as <code className="font-mono">otp.unlock</code> against your
          admin account.
        </p>
      </div>
    </Modal>
  );
}

function AddAllowedCountryModal({ onClose }) {
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ countryCode: '', name: '', flag: '' });

  const matches = useMemo(() => searchWorldCountries(search), [search]);

  const mutation = useApiMutation({
    mutationFn: () =>
      otpApi.addAllowedCountry({
        countryCode: form.countryCode.trim(),
        name: form.name.trim(),
        flag: form.flag.trim() || null,
      }),
    successMessage: 'Country added to OTP allow-list',
    invalidate: [['otp']],
    onSuccess: onClose,
  });

  const valid =
    /^\+?[1-9]\d{0,3}$/.test(form.countryCode.trim()) && form.name.trim().length >= 2;

  const selectCountry = (row) => {
    setForm({
      countryCode: row.countryCode,
      name: row.name,
      flag: row.flag || '',
    });
    setSearch(`${row.flag} ${row.name} (${row.countryCode})`);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Add allowed country"
      description="Search by name or dial code, then add. Flag, name, and code fill automatically."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            <Plus className="size-4" />
            Add country
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {mutation.error && <ErrorState error={mutation.error} compact />}

        <Field
          label="Search country"
          hint="Type a name (India) or code (+91 / 91). Results are filtered instantly on this device."
          required
        >
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search name or country code…"
            autoFocus
          />
          <ul
            className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-ink-200 bg-white divide-y divide-ink-100"
            role="listbox"
          >
            {matches.map((row) => {
              const selected =
                form.countryCode === row.countryCode && form.name === row.name;
              return (
                <li key={`${row.iso2}-${row.countryCode}-${row.name}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-brand-50 ${
                      selected ? 'bg-brand-50' : ''
                    }`}
                    onClick={() => selectCountry(row)}
                  >
                    <span className="text-lg leading-none" aria-hidden>
                      {row.flag || '🏳️'}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium text-ink-900">
                      {row.name}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-ink-500">
                      {row.countryCode}
                    </span>
                  </button>
                </li>
              );
            })}
            {!matches.length && (
              <li className="px-3 py-3 text-sm text-ink-500">No countries match.</li>
            )}
          </ul>
        </Field>

        <div className="rounded-lg border border-ink-200 bg-ink-50 px-3 py-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-500">
            Selected (auto-filled)
          </p>
          {form.name ? (
            <div className="mt-1.5 flex items-center gap-2 text-sm text-ink-900">
              <span className="text-xl leading-none">{form.flag || '🏳️'}</span>
              <span className="font-medium">{form.name}</span>
              <span className="font-mono text-xs text-ink-500">{form.countryCode}</span>
            </div>
          ) : (
            <p className="mt-1 text-sm text-ink-500">Pick a country from the list above.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function OtpPage() {
  const { can } = useAuth();
  const [editingField, setEditingField] = useState(null);
  const [unlocking, setUnlocking] = useState(null);
  const [addCountryOpen, setAddCountryOpen] = useState(false);

  const table = useTableState({ locked: 'true', search: '' });
  const ipTable = useTableState({ action: '', success: '', search: '', ip: '' }, { limit: 20 });

  const { data: summary } = useQuery({
    queryKey: qk.otpSummary,
    queryFn: () => otpApi.summary(),
  });

  const { data: allowedCountries, isLoading: countriesLoading } = useQuery({
    queryKey: qk.otpAllowedCountries,
    queryFn: () => otpApi.allowedCountries(),
  });

  const removeCountry = useApiMutation({
    mutationFn: (id) => otpApi.removeAllowedCountry(id),
    successMessage: 'Country removed from OTP allow-list',
    invalidate: [['otp']],
  });

  // `locked` is a string in filter state so the Select can round-trip it; the
  // 'all' option drops the predicate entirely on the server.
  const params = (() => {
    const { locked, ...rest } = table.params;
    return locked === 'all' ? { ...rest, all: true } : { ...rest, locked };
  })();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.otpLocks(params),
    queryFn: () => otpApi.locks(params),
  });

  const ipParams = {
    page: ipTable.page,
    limit: ipTable.pageSize,
    action: ipTable.filters.action || undefined,
    success:
      ipTable.filters.success === ''
        ? undefined
        : ipTable.filters.success === 'true',
    search: ipTable.filters.search || undefined,
    ip: ipTable.filters.ip || undefined,
  };

  const {
    data: ipLogs,
    isLoading: ipLoading,
    error: ipError,
    refetch: ipRefetch,
  } = useQuery({
    queryKey: qk.otpIpLogs(ipParams),
    queryFn: () => otpApi.ipLogs(ipParams),
  });

  const canUnlock = can(P.OTP_UNLOCK);
  const canEditPolicy = can(P.CONFIG_WRITE);
  const policy = summary?.policy;

  const columns = [
    {
      key: 'mobile',
      header: 'Number',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium tabular text-ink-900">{row.mobile}</p>
          <p className="truncate text-xs text-ink-500">
            {/* Rows are keyed by phone number, so a lock can exist with no
                account behind it - a number that never finished registering. */}
            {row.user ? row.user.name || 'Unnamed account' : 'No account registered'}
          </p>
        </div>
      ),
    },
    {
      key: 'locked',
      header: 'State',
      render: (row) =>
        row.locked ? (
          <Badge tone="danger" dot>
            Locked
          </Badge>
        ) : (
          <Badge tone="success">Active</Badge>
        ),
    },
    {
      key: 'requestCount',
      header: 'Codes sent',
      align: 'right',
      render: (row) => (
        <span className="tabular text-sm text-ink-800">
          {row.requestCount}
          {policy && <span className="text-ink-400"> / {policy.maxRequestsBeforeLock}</span>}
        </span>
      ),
    },
    {
      key: 'lockedAt',
      header: 'Locked',
      render: (row) =>
        row.lockedAt ? (
          <span className="text-xs text-ink-600" title={row.lockedReason || ''}>
            {fmtRelative(row.lockedAt)}
          </span>
        ) : (
          <span className="text-xs text-ink-400">—</span>
        ),
    },
    {
      key: 'lastRequestAt',
      header: 'Last request',
      render: (row) => (
        <span className="text-xs text-ink-600">
          {row.lastRequestAt ? fmtRelative(row.lastRequestAt) : '—'}
        </span>
      ),
    },
    {
      key: 'unlockCount',
      header: 'Unlocks',
      align: 'right',
      render: (row) =>
        row.unlockCount ? (
          <Badge tone="warning">{row.unlockCount}</Badge>
        ) : (
          <span className="text-xs text-ink-400">0</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) =>
        row.locked && canUnlock ? (
          <Button size="sm" variant="secondary" onClick={() => setUnlocking(row)}>
            <LockOpen className="size-3.5" />
            Unlock
          </Button>
        ) : null,
    },
  ];

  const ipColumns = [
    {
      key: 'createdAt',
      header: 'When',
      render: (row) => (
        <span className="text-xs text-ink-600" title={fmtDateTime(row.createdAt)}>
          {fmtRelative(row.createdAt)}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (row) => <Badge tone={row.action === 'VERIFY' ? 'brand' : 'neutral'}>{row.action}</Badge>,
    },
    {
      key: 'ip',
      header: 'IP',
      render: (row) => <span className="font-mono text-xs text-ink-800">{row.ip || '—'}</span>,
    },
    {
      key: 'mobile',
      header: 'Mobile',
      render: (row) => <span className="tabular text-sm text-ink-800">{row.mobile || '—'}</span>,
    },
    {
      key: 'success',
      header: 'Result',
      render: (row) =>
        row.success ? (
          <Badge tone="success">OK</Badge>
        ) : (
          <Badge tone="danger" title={row.failureReason || ''}>
            Failed
          </Badge>
        ),
    },
    {
      key: 'failureReason',
      header: 'Error',
      render: (row) =>
        row.failureReason ? (
          <span className="line-clamp-2 max-w-xs text-xs text-rose-700" title={row.failureReason}>
            {row.failureReason}
          </span>
        ) : (
          <span className="text-xs text-ink-400">—</span>
        ),
    },
    {
      key: 'purpose',
      header: 'Purpose',
      render: (row) => <span className="text-xs text-ink-600">{row.purpose || '—'}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="OTP &amp; lockouts"
        description="Verification codes are 5 mixed letters and digits. The first is sent immediately, then each resend waits, and a number that exhausts its budget stays locked until you release it here (or the user successfully verifies a code already sent)."
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-50">
              <ShieldAlert className="size-4.5 text-red-600" />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-ink-500">Currently locked</p>
              <p className="text-2xl font-semibold tabular text-ink-900">
                {summary ? summary.lockedCount : '—'}
              </p>
              <p className="mt-0.5 text-[11px] text-ink-500">
                Locks never expire on their own.
              </p>
            </div>
          </div>
        </Card>

        {POLICY_FIELDS.map((field) => (
          <Card key={field.key}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-ink-500">{field.label}</p>
                <p className="text-2xl font-semibold tabular text-ink-900">
                  {policy ? policy[field.policyField] : '—'}
                </p>
                <p className="mt-0.5 text-[11px] text-ink-500">{field.unit}</p>
              </div>
              {canEditPolicy && policy && (
                <Button size="sm" variant="secondary" onClick={() => setEditingField(field)}>
                  Edit
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {!canEditPolicy && (
        <div className="mb-4 rounded-lg border border-ink-200 bg-white px-4 py-3 text-sm text-ink-600">
          Changing the resend timings and attempt limit needs the{' '}
          <code className="font-mono text-xs">config:write</code> permission.
        </div>
      )}

      <Card
        className="mb-6"
        title="Allowed countries for OTP"
        description="Send/verify OTP is limited to these dial codes. Seeded with the previous hardcoded list; add or remove as needed."
        actions={
          canUnlock ? (
            <Button size="sm" onClick={() => setAddCountryOpen(true)}>
              <Plus className="size-3.5" />
              Add country
            </Button>
          ) : null
        }
      >
        {countriesLoading ? (
          <p className="text-sm text-ink-500">Loading…</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(allowedCountries?.data || []).map((row) => (
              <span
                key={row.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-ink-50 px-3 py-1 text-sm text-ink-800"
              >
                <span className="text-base leading-none" aria-hidden>
                  {row.flag || '🏳️'}
                </span>
                <span className="font-medium">{row.name}</span>
                <span className="font-mono text-xs text-ink-500">{row.countryCode}</span>
                {canUnlock && (
                  <button
                    type="button"
                    title="Remove"
                    className="rounded p-0.5 text-ink-400 hover:bg-ink-200 hover:text-rose-600"
                    disabled={removeCountry.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Remove ${row.name} (${row.countryCode}) from OTP allow-list?`,
                        )
                      ) {
                        removeCountry.mutate(row.id);
                      }
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </span>
            ))}
            {!countriesLoading && !(allowedCountries?.data || []).length && (
              <p className="text-sm text-ink-500">No countries configured.</p>
            )}
          </div>
        )}
        {removeCountry.error && (
          <div className="mt-3">
            <ErrorState error={removeCountry.error} compact />
          </div>
        )}
      </Card>

      <Card bodyClassName="">
        <FilterBar onReset={table.isFiltered ? table.reset : undefined}>
          <Field label="Search" className="w-full sm:w-56">
            <SearchInput
              value={table.filters.search}
              onChange={(v) => table.setFilter('search', v)}
              placeholder="Mobile number"
            />
          </Field>

          <Field label="State" className="w-44">
            <Select
              value={table.filters.locked}
              onChange={(e) => table.setFilter('locked', e.target.value)}
            >
              <option value="true">Locked only</option>
              <option value="false">Counting, not locked</option>
              <option value="all">All tracked numbers</option>
            </Select>
          </Field>
        </FilterBar>

        <DataTable
          columns={columns}
          rows={data?.data}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          emptyIcon={KeyRound}
          emptyTitle={
            table.filters.locked === 'true'
              ? 'No numbers are locked'
              : 'No numbers match these filters'
          }
          emptyDescription={
            table.filters.locked === 'true'
              ? 'Numbers appear here once they exhaust their OTP request budget without verifying.'
              : undefined
          }
        />

        <Pagination
          meta={data?.meta}
          onPageChange={table.setPage}
          onLimitChange={table.changeLimit}
        />
      </Card>

      <div className="mt-6">
        <PageHeader
          title="OTP IP logs"
          description="Every send and verify attempt with client IP. Logging is best-effort and never blocks OTP for users."
        />
        <Card bodyClassName="">
          <FilterBar onReset={ipTable.isFiltered ? ipTable.reset : undefined}>
            <Field label="Search" className="w-full sm:w-56">
              <SearchInput
                value={ipTable.filters.search}
                onChange={(v) => ipTable.setFilter('search', v)}
                placeholder="Mobile or IP"
              />
            </Field>
            <Field label="Action" className="w-40">
              <Select
                value={ipTable.filters.action}
                onChange={(e) => ipTable.setFilter('action', e.target.value)}
              >
                <option value="">All</option>
                <option value="SEND">Send</option>
                <option value="VERIFY">Verify</option>
              </Select>
            </Field>
            <Field label="Result" className="w-40">
              <Select
                value={ipTable.filters.success}
                onChange={(e) => ipTable.setFilter('success', e.target.value)}
              >
                <option value="">All</option>
                <option value="true">Success</option>
                <option value="false">Failed</option>
              </Select>
            </Field>
            <Field label="IP" className="w-44">
              <SearchInput
                value={ipTable.filters.ip}
                onChange={(v) => ipTable.setFilter('ip', v)}
                placeholder="Exact / partial IP"
              />
            </Field>
          </FilterBar>

          <DataTable
            columns={ipColumns}
            rows={ipLogs?.data}
            loading={ipLoading}
            error={ipError}
            onRetry={ipRefetch}
            emptyIcon={KeyRound}
            emptyTitle="No OTP IP logs yet"
          />

          <Pagination
            meta={ipLogs?.meta}
            onPageChange={ipTable.setPage}
            onLimitChange={ipTable.changeLimit}
          />
        </Card>
      </div>

      {editingField && (
        <EditPolicyModal
          field={editingField}
          currentValue={policy?.[editingField.policyField]}
          onClose={() => setEditingField(null)}
        />
      )}
      {unlocking && <UnlockModal row={unlocking} onClose={() => setUnlocking(null)} />}
      {addCountryOpen && <AddAllowedCountryModal onClose={() => setAddCountryOpen(false)} />}
    </>
  );
}
