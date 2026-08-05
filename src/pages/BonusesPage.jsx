import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Gift, Play } from 'lucide-react';
import { bonusesApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { useApiMutation } from '../hooks/useApiMutation';
import { useAuth } from '../auth/AuthContext';
import { P } from '../auth/permissions';
import { DataTable, Pagination } from '../components/DataTable';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ErrorState,
  Field,
  Input,
  JsonBlock,
  Modal,
  PageHeader,
  Select,
  StatusBadge,
  Toggle,
} from '../components/ui';
import { useTableState } from '../hooks/useTableState';
import { fmtDate, fmtDateTime, fmtNumber, fmtTokens, shortId } from '../lib/format';

const toDateInput = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

const weekEndFromStart = (startDate) => {
  if (!startDate) return '';
  const start = new Date(`${startDate}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) return '';
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
  return end.toISOString().slice(0, 10);
};

function WeeklySettingsCard() {
  const { can } = useAuth();
  const writable = can(P.BONUSES_WRITE);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.weeklySettings,
    queryFn: () => bonusesApi.weeklySettings(),
  });

  const [caller, setCaller] = useState(null);
  const [listener, setListener] = useState(null);

  useEffect(() => {
    if (!data) return;
    setCaller({
      ...data.caller,
      periodStartInput: toDateInput(data.caller.periodStart),
    });
    setListener({
      ...data.listener,
      periodStartInput: toDateInput(data.listener.periodStart),
    });
  }, [data]);

  const save = useApiMutation({
    mutationFn: (body) => bonusesApi.updateWeeklySettings(body),
    successMessage: (_d, vars) =>
      vars.audience === 'LISTENER' ? 'Listener weekly bonus updated' : 'User weekly bonus updated',
    invalidate: [['bonuses'], ['config']],
  });

  const renderEditor = (label, form, setForm, audience) => {
    if (!form) return null;
    const isListener = audience === 'LISTENER';
    return (
      <div className="space-y-3 rounded-lg border border-ink-100 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-ink-900">{label}</p>
          <Badge tone={isListener ? 'info' : 'brand'}>{audience}</Badge>
        </div>
        <Toggle
          checked={Boolean(form.enabled)}
          disabled={!writable || save.isPending}
          onChange={(v) => setForm({ ...form, enabled: v })}
          label="Enabled"
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Target minutes">
            <Input
              type="number"
              min="1"
              value={form.targetMinutes ?? ''}
              disabled={!writable}
              onChange={(e) => setForm({ ...form, targetMinutes: e.target.value })}
            />
          </Field>
          <Field
            label={isListener ? 'Reward (paise)' : 'Reward tokens'}
            hint={
              isListener
                ? 'Credited to listener earnings (same payout pool as call pay). 100 paise = ₹1.'
                : 'Credited as tokens to the user wallet.'
            }
          >
            <Input
              type="number"
              min="0"
              value={form.rewardTokens ?? ''}
              disabled={!writable}
              onChange={(e) => setForm({ ...form, rewardTokens: e.target.value })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Period start" hint="UTC date. End is auto-filled as start + 7 days.">
            <Input
              type="date"
              value={form.periodStartInput || ''}
              disabled={!writable}
              onChange={(e) => setForm({ ...form, periodStartInput: e.target.value })}
            />
          </Field>
          <Field label="Period end" hint="Read-only — week end from start date.">
            <Input type="date" value={weekEndFromStart(form.periodStartInput)} disabled />
          </Field>
        </div>
        {writable && (
          <Button
            size="sm"
            loading={save.isPending}
            onClick={() =>
              save.mutate({
                audience,
                enabled: Boolean(form.enabled),
                targetMinutes: Number(form.targetMinutes),
                rewardTokens: Number(form.rewardTokens),
                periodStart: form.periodStartInput
                  ? new Date(`${form.periodStartInput}T00:00:00.000Z`).toISOString()
                  : undefined,
              })
            }
          >
            Save {label.toLowerCase()}
          </Button>
        )}
      </div>
    );
  };

  return (
    <Card
      title="Weekly bonus settings"
      description="Set start date (end auto = +7 days). Cron awards after period end, then rolls the start forward. Users get tokens; listeners get paise earnings."
    >
      {error && <ErrorState error={error} onRetry={refetch} compact />}
      {isLoading && !data ? (
        <p className="text-sm text-ink-500">Loading settings…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {renderEditor('User weekly bonus', caller, setCaller, 'CALLER')}
          {renderEditor('Listener weekly bonus', listener, setListener, 'LISTENER')}
        </div>
      )}
      {save.error && (
        <div className="mt-3">
          <ErrorState error={save.error} compact />
        </div>
      )}
    </Card>
  );
}

/**
 * Manual weekly-bonus trigger.
 *
 * The run is idempotent per period+audience: without `force`, a period that
 * already has a completed run is skipped rather than paying twice.
 */
function RunWeeklyModal({ onClose }) {
  const [form, setForm] = useState({
    audience: 'CALLER',
    periodStart: '',
    periodEnd: '',
    dryRun: true,
    force: false,
  });
  const [result, setResult] = useState(null);

  const mutation = useApiMutation({
    mutationFn: () => {
      const periodStart = form.periodStart
        ? new Date(`${form.periodStart}T00:00:00.000Z`).toISOString()
        : undefined;
      const periodEnd = form.periodStart
        ? new Date(
            new Date(`${form.periodStart}T00:00:00.000Z`).getTime() + 7 * 24 * 60 * 60 * 1000 - 1,
          ).toISOString()
        : undefined;
      return bonusesApi.runWeekly({
        audience: form.audience,
        periodStart,
        periodEnd,
        dryRun: form.dryRun,
        force: form.force,
      });
    },
    successMessage: (data) =>
      form.dryRun
        ? `Dry run complete: ${data.usersQualifying ?? data.usersRewarded ?? 0} would qualify`
        : `Run complete: ${fmtNumber(data.tokensAwarded ?? 0)} awarded`,
    invalidate: [['bonuses'], ['dashboard'], ['wallet']],
    onSuccess: (data) => setResult(data),
  });

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Run the weekly bonus"
      description="Trigger user or listener weekly bonus independently. Dry-run first on production data."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            variant={form.dryRun ? 'primary' : 'danger'}
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
          >
            {form.dryRun ? 'Preview eligibility' : 'Run and award'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {mutation.error && <ErrorState error={mutation.error} compact />}

        <Field label="Audience" required>
          <Select
            value={form.audience}
            onChange={(e) => setForm({ ...form, audience: e.target.value })}
          >
            <option value="CALLER">User (caller)</option>
            <option value="LISTENER">Listener</option>
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Period start" hint="Leave blank to use the configured admin period.">
            <Input
              type="date"
              value={form.periodStart}
              onChange={(e) =>
                setForm({
                  ...form,
                  periodStart: e.target.value,
                  periodEnd: e.target.value ? weekEndFromStart(e.target.value) : '',
                })
              }
            />
          </Field>
          <Field label="Period end" hint="Auto week-end from start when you pick a start date.">
            <Input
              type="date"
              value={form.periodEnd}
              onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
            />
          </Field>
        </div>

        <div className="space-y-3 rounded-lg bg-ink-50 px-3.5 py-3">
          <Checkbox
            checked={form.dryRun}
            onChange={(v) => setForm({ ...form, dryRun: v })}
            label="Dry run"
            description="Compute who qualifies and report it without crediting any wallet."
          />
          <Checkbox
            checked={form.force}
            onChange={(v) => setForm({ ...form, force: v })}
            label="Force re-run"
            description="Overrides the idempotency guard for a period that already completed. Without this, a duplicate period is skipped."
          />
        </div>

        {!form.dryRun && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            This credits real wallets. Per-user awards are still idempotent, so an interrupted run
            can be safely repeated — but <span className="font-medium">force</span> combined with a
            live run is the one way to pay a period twice.
          </p>
        )}

        {result && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-ink-700">Result</p>
            <JsonBlock value={result} maxHeight="14rem" />
          </div>
        )}
      </div>
    </Modal>
  );
}

function WeeklyRunsTab() {
  const { can } = useAuth();
  const table = useTableState({ audience: '' }, { limit: 20 });
  const [runOpen, setRunOpen] = useState(false);
  const [awardsFor, setAwardsFor] = useState(null);

  const params = {
    ...table.params,
    ...(table.filters.audience ? { audience: table.filters.audience } : {}),
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.weeklyRuns(params),
    queryFn: () => bonusesApi.weeklyRuns(params),
  });

  const columns = [
    {
      key: 'audience',
      header: 'Audience',
      render: (row) => (
        <Badge tone={row.audience === 'LISTENER' ? 'info' : 'brand'}>
          {row.audience === 'LISTENER' ? 'Listener' : 'User'}
        </Badge>
      ),
    },
    {
      key: 'period',
      header: 'Period',
      render: (row) => (
        <span className="text-sm text-ink-800">
          {fmtDate(row.periodStart)} → {fmtDate(row.periodEnd)}
        </span>
      ),
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'usersRewarded',
      header: 'Rewarded',
      align: 'right',
      render: (row) => fmtNumber(row.usersRewarded),
    },
    {
      key: 'tokensAwarded',
      header: 'Tokens awarded',
      align: 'right',
      render: (row) => (
        <span className="font-medium text-emerald-700">{fmtTokens(row.tokensAwarded)}</span>
      ),
    },
    {
      key: 'target',
      header: 'Target',
      align: 'right',
      render: (row) =>
        row.targetMinutes ? (
          <span className="text-xs text-ink-600">{row.targetMinutes} min</span>
        ) : (
          '—'
        ),
    },
    {
      key: 'triggeredBy',
      header: 'Trigger',
      render: (row) => (
        <Badge tone={row.triggeredBy === 'CRON' || !row.triggeredBy ? 'neutral' : 'info'}>
          {row.triggeredBy || 'cron'}
        </Badge>
      ),
    },
    {
      key: 'completedAt',
      header: 'Completed',
      render: (row) => (
        <span className="text-xs text-ink-600">{fmtDateTime(row.completedAt || row.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <Button size="sm" variant="ghost" onClick={() => setAwardsFor(row)}>
          Awards
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <WeeklySettingsCard />

      <Card
        title="Weekly bonus runs"
        description="One row per period and audience. User and listener runs are tracked separately."
        actions={
          can(P.BONUSES_WRITE) && (
            <Button size="sm" onClick={() => setRunOpen(true)}>
              <Play className="size-4" />
              Trigger a run
            </Button>
          )
        }
        bodyClassName=""
      >
        <div className="flex flex-wrap gap-3 border-b border-ink-100 px-5 py-3">
          <Field label="Audience" className="w-44">
            <Select
              value={table.filters.audience}
              onChange={(e) => table.setFilter('audience', e.target.value)}
            >
              <option value="">All</option>
              <option value="CALLER">User (caller)</option>
              <option value="LISTENER">Listener</option>
            </Select>
          </Field>
        </div>
        <DataTable
          columns={columns}
          rows={data?.data}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          emptyIcon={Gift}
          emptyTitle="No weekly bonus runs yet"
          emptyDescription="The scheduled job creates a row each week once enabled."
        />
        <Pagination
          meta={data?.meta}
          onPageChange={table.setPage}
          onLimitChange={table.changeLimit}
        />
      </Card>

      {runOpen && <RunWeeklyModal onClose={() => setRunOpen(false)} />}
      {awardsFor && <AwardsModal run={awardsFor} onClose={() => setAwardsFor(null)} />}
    </div>
  );
}

function AwardsModal({ run, onClose }) {
  const table = useTableState({}, { limit: 20 });

  const { data, isLoading, error } = useQuery({
    queryKey: qk.weeklyAwards(run.id, table.params),
    queryFn: () => bonusesApi.weeklyAwards(run.id, table.params),
  });

  const columns = [
    {
      key: 'user',
      header: 'User',
      render: (row) => (
        <span className="text-sm text-ink-800">{row.user?.name || shortId(row.userId)}</span>
      ),
    },
    {
      key: 'minutes',
      header: 'Minutes talked',
      align: 'right',
      render: (row) => fmtNumber(row.qualifyingMinutes ?? row.minutes),
    },
    {
      key: 'tokens',
      header: run.audience === 'LISTENER' ? 'Paise' : 'Tokens',
      align: 'right',
      render: (row) => (
        <span className="font-medium text-emerald-700">
          {run.audience === 'LISTENER'
            ? fmtNumber(row.tokensAwarded)
            : fmtTokens(row.tokensAwarded)}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Awarded',
      render: (row) => <span className="text-xs text-ink-600">{fmtDateTime(row.createdAt)}</span>,
    },
  ];

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title="Weekly bonus awards"
      description={`${fmtDate(run.periodStart)} → ${fmtDate(run.periodEnd)} · ${fmtNumber(run.usersRewarded)} user(s)`}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="-mx-5 -my-4">
        <DataTable
          columns={columns}
          rows={data?.data}
          loading={isLoading}
          error={error}
          emptyIcon={Gift}
          emptyTitle="No awards in this run"
          emptyDescription="No user reached the target for this period."
          dense
        />
        <Pagination
          meta={data?.meta}
          onPageChange={table.setPage}
          onLimitChange={table.changeLimit}
        />
      </div>
    </Modal>
  );
}

export function BonusesPage() {
  return (
    <>
      <PageHeader
        title="Bonuses"
        description="Weekly talk-time rewards: users earn tokens, listeners earn paise into their earnings. Set period start (end auto +7 days); cron awards after the period ends."
      />
      <WeeklyRunsTab />
    </>
  );
}
