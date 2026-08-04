import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Gift, Play, Plus } from 'lucide-react';
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
  Tabs,
  Textarea,
  Toggle,
} from '../components/ui';
import { useTableState } from '../hooks/useTableState';
import { fmtDate, fmtDateTime, fmtNumber, fmtTokens, shortId } from '../lib/format';

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
    setCaller({ ...data.caller });
    setListener({ ...data.listener });
  }, [data]);

  const save = useApiMutation({
    mutationFn: (body) => bonusesApi.updateWeeklySettings(body),
    successMessage: (_d, vars) =>
      vars.audience === 'LISTENER' ? 'Listener weekly bonus updated' : 'User weekly bonus updated',
    invalidate: [['bonuses'], ['config']],
  });

  const renderEditor = (label, form, setForm, audience) => {
    if (!form) return null;
    return (
      <div className="space-y-3 rounded-lg border border-ink-100 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-ink-900">{label}</p>
          <Badge tone={audience === 'LISTENER' ? 'info' : 'brand'}>{audience}</Badge>
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
          <Field label="Reward tokens">
            <Input
              type="number"
              min="0"
              value={form.rewardTokens ?? ''}
              disabled={!writable}
              onChange={(e) => setForm({ ...form, rewardTokens: e.target.value })}
            />
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
      description="Separate rules for users (callers) and listeners. Cron evaluates each audience independently."
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
      {save.error && <div className="mt-3"><ErrorState error={save.error} compact /></div>}
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
    mutationFn: () =>
      bonusesApi.runWeekly({
        audience: form.audience,
        periodStart: form.periodStart || undefined,
        periodEnd: form.periodEnd || undefined,
        dryRun: form.dryRun,
        force: form.force,
      }),
    successMessage: (data) =>
      form.dryRun
        ? `Dry run complete: ${data.usersQualifying ?? data.usersRewarded ?? 0} would qualify`
        : `Run complete: ${fmtTokens(data.tokensAwarded ?? 0)} tokens awarded`,
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
            {form.dryRun ? 'Preview eligibility' : 'Run and award tokens'}
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
          <Field label="Period start" hint="Leave blank for the previous complete week.">
            <Input
              type="date"
              value={form.periodStart}
              onChange={(e) => setForm({ ...form, periodStart: e.target.value })}
            />
          </Field>
          <Field label="Period end">
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
      header: 'Tokens',
      align: 'right',
      render: (row) => (
        <span className="font-medium text-emerald-700">{fmtTokens(row.tokensAwarded)}</span>
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

// --- Promotions -------------------------------------------------------------

function PromotionFormModal({ promotion, onClose }) {
  const editing = Boolean(promotion);
  const [form, setForm] = useState({
    name: promotion?.name || '',
    description: promotion?.description || '',
    tokens: promotion?.tokens ?? '',
    active: promotion?.active ?? true,
    startsAt: promotion?.startsAt ? promotion.startsAt.slice(0, 10) : '',
    endsAt: promotion?.endsAt ? promotion.endsAt.slice(0, 10) : '',
  });

  const mutation = useApiMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        description: form.description || undefined,
        tokens: Number(form.tokens),
        active: form.active,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
      };
      return editing
        ? bonusesApi.updatePromotion(promotion.id, body)
        : bonusesApi.createPromotion(body);
    },
    successMessage: editing ? 'Campaign updated' : 'Campaign created',
    invalidate: [['bonuses', 'promotions']],
    onSuccess: onClose,
  });

  const fieldErrors = mutation.error?.fieldErrors || {};

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? `Edit ${promotion.name}` : 'New promotional campaign'}
      description="A campaign defines the token grant. Granting to users is a separate, explicit step."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!form.name.trim() || !form.tokens}
          >
            {editing ? 'Save changes' : 'Create campaign'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {mutation.error && <ErrorState error={mutation.error} compact />}

        <Field label="Name" required error={fieldErrors.name}>
          <Input
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Diwali 2026"
          />
        </Field>

        <Field label="Description" error={fieldErrors.description}>
          <Textarea
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>

        <Field label="Tokens per user" required error={fieldErrors.tokens}>
          <Input
            type="number"
            min="1"
            value={form.tokens}
            onChange={(e) => setForm({ ...form, tokens: e.target.value })}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts at">
            <Input
              type="date"
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
            />
          </Field>
          <Field label="Ends at">
            <Input
              type="date"
              value={form.endsAt}
              onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
            />
          </Field>
        </div>

        <Toggle
          checked={form.active}
          onChange={(v) => setForm({ ...form, active: v })}
          label="Active (grants permitted)"
        />
      </div>
    </Modal>
  );
}

function GrantModal({ promotion, onClose }) {
  const [userIds, setUserIds] = useState('');

  const ids = userIds
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const mutation = useApiMutation({
    mutationFn: () => bonusesApi.grantPromotion(promotion.id, { userIds: ids }),
    successMessage: (data) =>
      `Granted to ${data.granted ?? ids.length} user(s)${data.skipped ? `, ${data.skipped} skipped` : ''}`,
    invalidate: [['bonuses'], ['wallet']],
    onSuccess: onClose,
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Grant ${promotion.name}`}
      description={`${fmtTokens(promotion.tokens)} tokens per user. A user who already received this campaign is skipped, not paid twice.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={ids.length === 0}>
            Grant to {ids.length} user(s)
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {mutation.error && <ErrorState error={mutation.error} compact />}

        <Field
          label="User ids"
          required
          hint={`Comma, space or newline separated. ${ids.length} id(s) entered.`}
        >
          <Textarea
            rows={6}
            value={userIds}
            onChange={(e) => setUserIds(e.target.value)}
            className="font-mono text-xs"
            placeholder="9f1c2e40-1111-4a2b-8c3d-000000000001"
          />
        </Field>

        {ids.length > 0 && (
          <div className="rounded-lg bg-ink-50 px-3.5 py-2.5 text-sm">
            <span className="text-ink-500">Total tokens to grant: </span>
            <span className="font-semibold tabular text-ink-900">
              {fmtTokens(ids.length * (promotion.tokens || 0))}
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}

function PromotionsTab() {
  const { can } = useAuth();
  const table = useTableState({}, { limit: 20 });
  const [formFor, setFormFor] = useState(null);
  const [creating, setCreating] = useState(false);
  const [grantFor, setGrantFor] = useState(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.promotions(table.params),
    queryFn: () => bonusesApi.promotions(table.params),
  });

  const writable = can(P.BONUSES_WRITE);

  const columns = [
    {
      key: 'name',
      header: 'Campaign',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink-900">{row.name}</p>
          {row.description && (
            <p className="truncate text-xs text-ink-500">{row.description}</p>
          )}
        </div>
      ),
    },
    {
      key: 'tokens',
      header: 'Tokens',
      align: 'right',
      render: (row) => <span className="font-medium text-ink-800">{fmtTokens(row.tokens)}</span>,
    },
    {
      key: 'active',
      header: 'Active',
      render: (row) => (
        <Badge tone={row.active ? 'success' : 'neutral'}>{row.active ? 'Yes' : 'No'}</Badge>
      ),
    },
    {
      key: 'window',
      header: 'Window',
      render: (row) => (
        <span className="text-xs text-ink-600">
          {row.startsAt || row.endsAt
            ? `${fmtDate(row.startsAt)} → ${fmtDate(row.endsAt)}`
            : 'No window set'}
        </span>
      ),
    },
    {
      key: 'grants',
      header: 'Granted',
      align: 'right',
      render: (row) => fmtNumber(row.grantCount ?? row._count?.grants ?? 0),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) =>
        writable && (
          <div className="flex items-center justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => setFormFor(row)}>
              Edit
            </Button>
            <Button size="sm" variant="subtle" onClick={() => setGrantFor(row)} disabled={!row.active}>
              Grant
            </Button>
          </div>
        ),
    },
  ];

  return (
    <>
      <Card
        title="Promotional campaigns"
        description="Ad-hoc token grants, separate from the automatic welcome and weekly bonuses."
        actions={
          writable && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              New campaign
            </Button>
          )
        }
        bodyClassName=""
      >
        <DataTable
          columns={columns}
          rows={data?.data}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          emptyIcon={Gift}
          emptyTitle="No promotional campaigns"
          emptyDescription="Create one to grant bonus tokens to a specific set of users."
        />
        <Pagination
          meta={data?.meta}
          onPageChange={table.setPage}
          onLimitChange={table.changeLimit}
        />
      </Card>

      {(formFor || creating) && (
        <PromotionFormModal
          promotion={formFor}
          onClose={() => {
            setFormFor(null);
            setCreating(false);
          }}
        />
      )}
      {grantFor && <GrantModal promotion={grantFor} onClose={() => setGrantFor(null)} />}
    </>
  );
}

export function BonusesPage() {
  const [tab, setTab] = useState('weekly');

  return (
    <>
      <PageHeader
        title="Bonuses"
        description="Separate weekly talk-time rewards for users and listeners, plus promotional grants. Awards are idempotent per user, period, and audience."
      />

      <Tabs
        tabs={[
          { id: 'weekly', label: 'Weekly bonus' },
          { id: 'promotions', label: 'Promotional campaigns' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'weekly' ? <WeeklyRunsTab /> : <PromotionsTab />}
    </>
  );
}
