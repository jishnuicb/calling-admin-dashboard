import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { KeyRound, LockOpen, ShieldAlert } from 'lucide-react';
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

export function OtpPage() {
  const { can } = useAuth();
  const [editingField, setEditingField] = useState(null);
  const [unlocking, setUnlocking] = useState(null);

  const table = useTableState({ locked: 'true', search: '' });

  const { data: summary } = useQuery({
    queryKey: qk.otpSummary,
    queryFn: () => otpApi.summary(),
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

      {editingField && (
        <EditPolicyModal
          field={editingField}
          currentValue={policy?.[editingField.policyField]}
          onClose={() => setEditingField(null)}
        />
      )}
      {unlocking && <UnlockModal row={unlocking} onClose={() => setUnlocking(null)} />}
    </>
  );
}
