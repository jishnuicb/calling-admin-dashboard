import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Coins, Scale, Search } from 'lucide-react';
import { walletApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { useApiMutation } from '../hooks/useApiMutation';
import { useAuth } from '../auth/AuthContext';
import { P } from '../auth/permissions';
import { DataTable, FilterBar, Pagination } from '../components/DataTable';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ErrorState,
  Field,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
  Select,
} from '../components/ui';
import { useTableState } from '../hooks/useTableState';
import { fmtDateTime, fmtSigned, fmtTokens, shortId, titleCase } from '../lib/format';

const LEDGER_TYPES = [
  'PURCHASE',
  'WELCOME_BONUS',
  'WEEKLY_BONUS',
  'PROMOTIONAL_BONUS',
  'CALL_DEDUCTION',
  'ADMIN_ADJUSTMENT',
  'REFUND',
];

/**
 * Compares the cached `wallets.balance` against the summed ledger. They must
 * always agree; `repair` rewrites the cache from the ledger, which is the
 * authoritative side.
 */
function ReconcileModal({ userId, onClose }) {
  const [repair, setRepair] = useState(false);
  const [result, setResult] = useState(null);

  const mutation = useApiMutation({
    mutationFn: () => walletApi.reconcile(userId, { repair }),
    successMessage: null,
    invalidate: [['wallet']],
    onSuccess: (data) => setResult(data),
  });

  const drift = result?.drift ?? result?.difference;

  return (
    <Modal
      open
      onClose={onClose}
      title="Reconcile wallet"
      description="Recomputes the balance from the append-only ledger and compares it with the cached column."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>
            {repair ? 'Check and repair' : 'Run check'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {mutation.error && <ErrorState error={mutation.error} compact />}

        <Checkbox
          checked={repair}
          onChange={setRepair}
          label="Repair the cached balance if it has drifted"
          description="The ledger always wins. Without this, the check is read-only."
        />

        {result && (
          <div
            className={`rounded-lg px-3.5 py-3 ${
              drift ? 'border border-red-200 bg-red-50' : 'border border-emerald-200 bg-emerald-50'
            }`}
          >
            <p className={`text-sm font-medium ${drift ? 'text-red-800' : 'text-emerald-800'}`}>
              {drift ? 'Drift detected' : 'Balance matches the ledger'}
            </p>
            <dl className="mt-2 space-y-1 text-xs">
              {[
                ['Cached balance', result.balance ?? result.cachedBalance],
                ['Ledger sum', result.derivedBalance ?? result.ledgerBalance],
                ['Difference', drift],
              ].map(([label, value]) =>
                value === undefined || value === null ? null : (
                  <div key={label} className="flex justify-between">
                    <dt className="text-ink-600">{label}</dt>
                    <dd className="font-medium tabular text-ink-900">{fmtTokens(value)}</dd>
                  </div>
                ),
              )}
            </dl>
            {result.repaired && (
              <p className="mt-2 text-xs font-medium text-emerald-800">
                Cached balance was repaired from the ledger.
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function WalletLookup() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState('');

  return (
    <Card
      title="Inspect a wallet"
      description="Wallets are keyed by user. Open a user from the Users page, or paste an id here."
    >
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (userId.trim()) navigate(`/wallets/${userId.trim()}`);
        }}
      >
        <Field label="User id" className="min-w-64 flex-1">
          <Input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="9f1c2e40-1111-4a2b-8c3d-000000000001"
          />
        </Field>
        <Button type="submit" disabled={!userId.trim()}>
          <Search className="size-4" />
          Open wallet
        </Button>
      </form>
      <p className="mt-4 text-xs text-ink-500">
        The ledger is append-only and authoritative; the balance column is a cache updated in the
        same transaction as each entry. If they ever disagree, reconcile.
      </p>
      <Link
        to="/users"
        className="mt-3 inline-block text-xs font-medium text-brand-600 hover:underline"
      >
        Browse users instead
      </Link>
    </Card>
  );
}

export function WalletsPage() {
  const { userId } = useParams();
  const { can } = useAuth();
  const [reconcileOpen, setReconcileOpen] = useState(false);

  const table = useTableState({ type: '', from: '', to: '' });

  const { data: wallet, isLoading, error, refetch } = useQuery({
    queryKey: qk.wallet(userId),
    queryFn: () => walletApi.get(userId),
    enabled: Boolean(userId),
  });

  const { data: history, isLoading: historyLoading, error: historyError } = useQuery({
    queryKey: qk.walletHistory(userId, table.params),
    queryFn: () => walletApi.history(userId, table.params),
    enabled: Boolean(userId),
  });

  if (!userId) {
    return (
      <>
        <PageHeader title="Wallets" description="Inspect balances and the token ledger." />
        <WalletLookup />
      </>
    );
  }

  if (isLoading) return <LoadingBlock label="Loading wallet…" />;
  if (error) {
    return (
      <>
        <PageHeader title="Wallet" />
        <ErrorState error={error} onRetry={refetch} />
      </>
    );
  }

  const columns = [
    {
      key: 'type',
      header: 'Type',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-ink-800">{titleCase(row.type)}</p>
          {row.description && (
            <p className="truncate text-xs text-ink-500">{row.description}</p>
          )}
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Tokens',
      align: 'right',
      render: (row) => (
        <span
          className={`font-semibold ${row.amount < 0 ? 'text-red-600' : 'text-emerald-700'}`}
        >
          {fmtSigned(row.amount)}
        </span>
      ),
    },
    {
      key: 'purchaseAmount',
      header: 'Amount paid',
      align: 'right',
      render: (row) =>
        row.purchaseAmount != null || row.amountPaid != null ? (
          <span className="tabular text-sm text-ink-800">
            ₹{Number(row.purchaseAmount ?? row.amountPaid).toFixed(2)}
          </span>
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
    {
      key: 'balanceAfter',
      header: 'Balance after',
      align: 'right',
      render: (row) => fmtTokens(row.balanceAfter),
    },
    {
      key: 'reference',
      header: 'Reference',
      render: (row) =>
        row.referenceId ? (
          <span className="font-mono text-[11px] text-ink-600" title={row.referenceId}>
            {row.referenceType ? `${row.referenceType} ` : ''}
            {shortId(row.referenceId)}
          </span>
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
    {
      key: 'direction',
      header: 'Direction',
      render: (row) => (
        <Badge tone={row.direction === 'DEBIT' ? 'danger' : 'success'}>
          {titleCase(row.direction || (row.amount < 0 ? 'DEBIT' : 'CREDIT'))}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'When',
      render: (row) => <span className="text-xs text-ink-600">{fmtDateTime(row.createdAt)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link
            to="/users"
            className="mb-1.5 inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-700"
          >
            Users
          </Link>
        }
        title="Wallet"
        description={userId}
        actions={
          <>
            <Link to={`/users/${userId}`}>
              <Button variant="secondary">Open user</Button>
            </Link>
            {can(P.WALLET_ADJUST) && (
              <Button variant="secondary" onClick={() => setReconcileOpen(true)}>
                <Scale className="size-4" />
                Reconcile
              </Button>
            )}
          </>
        }
      />

      {/* The endpoint already reports the ledger-derived balance and the drift, so
          a mismatch is visible without having to run a reconcile first. */}
      {Boolean(wallet.drift) && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-800">
            This wallet has drifted from its ledger by {fmtTokens(wallet.drift)} tokens.
          </p>
          <p className="mt-1 text-xs text-red-700">
            The cached balance reads {fmtTokens(wallet.balance)} but the ledger sums to{' '}
            {fmtTokens(wallet.derivedBalance)}. The ledger is authoritative — reconcile with repair
            to rewrite the cache.
          </p>
        </div>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-medium text-ink-500">Current balance</p>
          <p className="mt-1 text-3xl font-semibold tabular text-ink-900">
            {fmtTokens(wallet.balance)}
          </p>
          <p className="mt-0.5 text-xs text-ink-500">
            {wallet.derivedBalance !== undefined && !wallet.drift
              ? 'tokens · matches ledger'
              : 'tokens'}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-ink-500">Total credited</p>
          <p className="mt-1 text-3xl font-semibold tabular text-emerald-700">
            {fmtTokens(wallet.totalCredited)}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-ink-500">Total debited</p>
          <p className="mt-1 text-3xl font-semibold tabular text-red-600">
            {fmtTokens(wallet.totalDebited)}
          </p>
        </Card>
      </div>

      <Card title="Ledger" description="Append-only and authoritative." bodyClassName="">
        <FilterBar onReset={table.isFiltered ? table.reset : undefined}>
          <Field label="Type" className="w-48">
            <Select
              value={table.filters.type}
              onChange={(e) => table.setFilter('type', e.target.value)}
            >
              <option value="">All types</option>
              {LEDGER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {titleCase(t)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="From" className="w-36">
            <Input
              type="date"
              value={table.filters.from}
              onChange={(e) => table.setFilter('from', e.target.value)}
            />
          </Field>
          <Field label="To" className="w-36">
            <Input
              type="date"
              value={table.filters.to}
              onChange={(e) => table.setFilter('to', e.target.value)}
            />
          </Field>
        </FilterBar>

        <DataTable
          columns={columns}
          rows={history?.data}
          loading={historyLoading}
          error={historyError}
          emptyIcon={Coins}
          emptyTitle="No ledger entries"
          emptyDescription="This wallet has no transactions matching the filters."
          dense
        />

        <Pagination
          meta={history?.meta}
          onPageChange={table.setPage}
          onLimitChange={table.changeLimit}
        />
      </Card>

      {reconcileOpen && (
        <ReconcileModal userId={userId} onClose={() => setReconcileOpen(false)} />
      )}
    </>
  );
}
