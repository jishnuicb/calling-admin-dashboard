import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Spade } from 'lucide-react';
import { cardGuessApi } from '../api/endpoints';
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
  PageHeader,
  Select,
  Tabs,
  Toggle,
} from '../components/ui';
import { useTableState } from '../hooks/useTableState';
import { fmtDateTime, fmtNumber, shortId } from '../lib/format';

const ROUND_STATUSES = ['DEALING', 'AWAITING_GUESS', 'COMPLETED', 'CANCELLED'];

const cardsLabel = (cards) =>
  Array.isArray(cards) && cards.length ? cards.join(' · ') : '—';

function SettingsTab() {
  const { can } = useAuth();
  const writable = can(P.CARD_GUESS_WRITE);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.cardGuessSettings,
    queryFn: () => cardGuessApi.settings(),
  });

  const [form, setForm] = useState(null);

  useEffect(() => {
    if (!data) return;
    setForm((prev) =>
      prev
        ? prev
        : {
            enabled: Boolean(data.enabled),
            deck: Array.isArray(data.deck) ? data.deck.join(',') : String(data.deck || ''),
            cardsPerRound: data.cardsPerRound ?? 3,
            scoreCorrect3: data.scores?.correct3 ?? 0,
            scoreCorrect2: data.scores?.correct2 ?? 0,
            scoreCorrect1: data.scores?.correct1 ?? 0,
            scoreCorrect0: data.scores?.correct0 ?? 0,
            pairCooldownMinutes: data.pairCooldownMinutes ?? 10,
            starterShuffleAllowed: Boolean(data.starterShuffleAllowed),
          },
    );
  }, [data]);

  const save = useApiMutation({
    mutationFn: (body) => cardGuessApi.updateSettings(body),
    successMessage: 'Card Guess settings saved',
    invalidate: [['card-guess'], ['config']],
    onSuccess: (updated) => {
      setForm({
        enabled: Boolean(updated.enabled),
        deck: Array.isArray(updated.deck) ? updated.deck.join(',') : String(updated.deck || ''),
        cardsPerRound: updated.cardsPerRound ?? 3,
        scoreCorrect3: updated.scores?.correct3 ?? 0,
        scoreCorrect2: updated.scores?.correct2 ?? 0,
        scoreCorrect1: updated.scores?.correct1 ?? 0,
        scoreCorrect0: updated.scores?.correct0 ?? 0,
        pairCooldownMinutes: updated.pairCooldownMinutes ?? 10,
        starterShuffleAllowed: Boolean(updated.starterShuffleAllowed),
      });
    },
  });

  if (isLoading && !form) {
    return <Card className="p-6 text-sm text-ink-500">Loading settings…</Card>;
  }
  if (error && !form) {
    return <ErrorState error={error} onRetry={refetch} />;
  }
  if (!form) return null;

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const onSave = () => {
    const deck = String(form.deck || '')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    save.mutate({
      enabled: Boolean(form.enabled),
      deck,
      cardsPerRound: Number(form.cardsPerRound),
      scoreCorrect3: Number(form.scoreCorrect3),
      scoreCorrect2: Number(form.scoreCorrect2),
      scoreCorrect1: Number(form.scoreCorrect1),
      scoreCorrect0: Number(form.scoreCorrect0),
      pairCooldownMinutes: Number(form.pairCooldownMinutes),
      starterShuffleAllowed: Boolean(form.starterShuffleAllowed),
    });
  };

  return (
    <Card className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink-900">Game settings</p>
          <p className="text-xs text-ink-500">
            Controls enablement, deck, scoring, and pair cooldown for Card Guess.
          </p>
        </div>
        <Toggle
          checked={form.enabled}
          disabled={!writable}
          onChange={(v) => set('enabled', v)}
          label={form.enabled ? 'Enabled' : 'Disabled'}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Cards per round" hint="1–13">
          <Input
            type="number"
            min={1}
            max={13}
            value={form.cardsPerRound}
            disabled={!writable}
            onChange={(e) => set('cardsPerRound', e.target.value)}
          />
        </Field>
        <Field label="Pair cooldown (minutes)" hint="0 disables cooldown">
          <Input
            type="number"
            min={0}
            max={1440}
            value={form.pairCooldownMinutes}
            disabled={!writable}
            onChange={(e) => set('pairCooldownMinutes', e.target.value)}
          />
        </Field>
        <Field label="Starter re-deal">
          <div className="pt-2">
            <Toggle
              checked={form.starterShuffleAllowed}
              disabled={!writable}
              onChange={(v) => set('starterShuffleAllowed', v)}
              label={form.starterShuffleAllowed ? 'Allowed' : 'Blocked'}
            />
          </div>
        </Field>
      </div>

      <Field label="Deck" hint="Comma-separated card labels (e.g. A,2,3,…,K)">
        <Input
          value={form.deck}
          disabled={!writable}
          onChange={(e) => set('deck', e.target.value)}
        />
      </Field>

      <div>
        <p className="mb-2 text-sm font-medium text-ink-700">Points by correct positions</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['scoreCorrect3', '3 correct'],
            ['scoreCorrect2', '2 correct'],
            ['scoreCorrect1', '1 correct'],
            ['scoreCorrect0', '0 correct'],
          ].map(([key, label]) => (
            <Field key={key} label={label}>
              <Input
                type="number"
                min={0}
                value={form[key]}
                disabled={!writable}
                onChange={(e) => set(key, e.target.value)}
              />
            </Field>
          ))}
        </div>
      </div>

      {writable ? (
        <div className="flex justify-end">
          <Button onClick={onSave} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save settings'}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-ink-500">
          You need <code>cardGuess:write</code> to edit settings.
        </p>
      )}
    </Card>
  );
}

function RoundsTab() {
  const table = useTableState({ status: '', callSessionId: '' });

  const params = {
    ...table.params,
    status: table.filters.status || undefined,
    callSessionId: table.filters.callSessionId || undefined,
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.cardGuessRounds(params),
    queryFn: () => cardGuessApi.rounds(params),
  });

  const columns = [
    {
      key: 'createdAt',
      header: 'When',
      render: (row) => (
        <span className="whitespace-nowrap text-xs tabular text-ink-700">
          {fmtDateTime(row.createdAt)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const tone =
          row.status === 'COMPLETED'
            ? 'success'
            : row.status === 'CANCELLED'
              ? 'danger'
              : row.status === 'AWAITING_GUESS'
                ? 'warning'
                : 'brand';
        return <Badge tone={tone}>{row.status}</Badge>;
      },
    },
    {
      key: 'participants',
      header: 'Caller → Listener',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-ink-900">
            {row.callerName || shortId(row.callerId)}
            <span className="mx-1.5 text-ink-400">→</span>
            {row.listenerName || shortId(row.listenerId)}
          </p>
          <p className="truncate font-mono text-[11px] text-ink-500">
            call {shortId(row.callSessionId)}
          </p>
        </div>
      ),
    },
    {
      key: 'roles',
      header: 'Starter / Guesser',
      render: (row) => (
        <div className="text-xs text-ink-700">
          <p>
            S: {row.starterName || shortId(row.starterUserId)}
          </p>
          <p>
            G: {row.guesserName || shortId(row.guesserUserId)}
          </p>
        </div>
      ),
    },
    {
      key: 'dealtCards',
      header: 'Dealt',
      render: (row) => (
        <span className="font-mono text-xs text-ink-800">{cardsLabel(row.dealtCards)}</span>
      ),
    },
    {
      key: 'pattern',
      header: 'Pattern',
      render: (row) => (
        <span className="font-mono text-xs text-ink-800">{cardsLabel(row.pattern)}</span>
      ),
    },
    {
      key: 'guess',
      header: 'Guess',
      render: (row) => (
        <span className="font-mono text-xs text-ink-800">{cardsLabel(row.guess)}</span>
      ),
    },
    {
      key: 'result',
      header: 'Result',
      render: (row) =>
        row.status === 'COMPLETED' ? (
          <div className="text-xs tabular text-ink-800">
            <p>{row.correctPositions ?? 0} correct</p>
            <p className="font-medium">{fmtNumber(row.pointsAwarded)} pts</p>
            {row.pointsUserName || row.pointsUserId ? (
              <p className="text-ink-500">→ {row.pointsUserName || shortId(row.pointsUserId)}</p>
            ) : null}
          </div>
        ) : row.cancelReason ? (
          <span className="text-xs text-ink-500">{row.cancelReason}</span>
        ) : (
          '—'
        ),
    },
    {
      key: 'links',
      header: '',
      render: (row) =>
        row.callSessionId ? (
          <Link
            to={`/calls/${row.callSessionId}`}
            className="text-xs font-medium text-brand-700 hover:underline"
          >
            Call
          </Link>
        ) : null,
    },
  ];

  return (
    <Card bodyClassName="">
      <FilterBar>
        <Field label="Status" className="w-44">
          <Select
            value={table.filters.status}
            onChange={(e) => table.setFilter('status', e.target.value)}
          >
            <option value="">All</option>
            {ROUND_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Call session ID" className="w-56">
          <Input
            value={table.filters.callSessionId}
            placeholder="UUID"
            onChange={(e) => table.setFilter('callSessionId', e.target.value)}
          />
        </Field>
        <div className="flex items-end">
          <Button variant="secondary" onClick={() => refetch()}>
            Refresh
          </Button>
        </div>
      </FilterBar>

      {error ? (
        <div className="p-4">
          <ErrorState error={error} onRetry={refetch} />
        </div>
      ) : (
        <>
          <DataTable columns={columns} rows={data?.data || []} loading={isLoading} />
          <Pagination meta={data?.meta} onPageChange={table.setPage} />
        </>
      )}
    </Card>
  );
}

function LeaderboardTab({ weekly }) {
  const table = useTableState({}, { limit: 50 });
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: weekly
      ? qk.cardGuessWeeklyLeaderboard(table.params)
      : qk.cardGuessLeaderboard(table.params),
    queryFn: () =>
      weekly
        ? cardGuessApi.weeklyLeaderboard(table.params)
        : cardGuessApi.leaderboard(table.params),
  });

  const columns = [
    {
      key: 'rank',
      header: '#',
      render: (row) => <span className="tabular text-sm text-ink-700">{row.rank}</span>,
    },
    {
      key: 'name',
      header: 'Listener',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink-900">{row.name || '—'}</p>
          <p className="truncate font-mono text-[11px] text-ink-500">
            {row.publicId || shortId(row.listenerUserId)}
          </p>
        </div>
      ),
    },
    {
      key: 'totalPoints',
      header: 'Points',
      render: (row) => (
        <span className="tabular text-sm font-medium text-ink-900">
          {fmtNumber(row.totalPoints)}
        </span>
      ),
    },
    {
      key: 'roundsWon',
      header: 'Won',
      render: (row) => <span className="tabular text-sm">{fmtNumber(row.roundsWon)}</span>,
    },
    {
      key: 'roundsPlayed',
      header: 'Played',
      render: (row) => <span className="tabular text-sm">{fmtNumber(row.roundsPlayed)}</span>,
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      render: (row) =>
        row.updatedAt ? (
          <span className="whitespace-nowrap text-xs text-ink-600">
            {fmtDateTime(row.updatedAt)}
          </span>
        ) : (
          '—'
        ),
    },
  ];

  return (
    <Card bodyClassName="">
      {weekly && data?.week ? (
        <div className="border-b border-ink-200 px-4 py-3 text-sm text-ink-700">
          IST week{' '}
          <span className="font-medium">
            {data.week.weekStartDate} → {data.week.weekEndDate}
          </span>{' '}
          <span className="text-ink-400">({data.week.timezone || 'Asia/Kolkata'})</span>
        </div>
      ) : null}

      {error ? (
        <div className="p-4">
          <ErrorState error={error} onRetry={refetch} />
        </div>
      ) : (
        <>
          <DataTable columns={columns} rows={data?.data || []} loading={isLoading} />
          <Pagination meta={data?.meta} onPageChange={table.setPage} />
        </>
      )}
    </Card>
  );
}

export function CardGuessPage() {
  const [tab, setTab] = useState('settings');

  const tabs = [
    { id: 'settings', label: 'Settings' },
    { id: 'rounds', label: 'Rounds' },
    { id: 'weekly', label: 'Weekly leaderboard' },
    { id: 'alltime', label: 'All-time leaderboard' },
  ];

  return (
    <>
      <PageHeader
        title="Card Guess"
        description="Mini-game settings, round history, and listener leaderboards (points go to the guesser)."
        actions={
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-500">
            <Spade className="size-3.5" />
            Activity
          </span>
        }
      />

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'settings' && <SettingsTab />}
      {tab === 'rounds' && <RoundsTab />}
      {tab === 'weekly' && <LeaderboardTab weekly />}
      {tab === 'alltime' && <LeaderboardTab />}
    </>
  );
}
