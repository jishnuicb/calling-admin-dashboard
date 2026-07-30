import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Ban, Coins, ShieldCheck } from 'lucide-react';
import { usersApi, walletApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { useApiMutation } from '../hooks/useApiMutation';
import { useAuth } from '../auth/AuthContext';
import { P } from '../auth/permissions';
import {
  Badge,
  Button,
  Card,
  DescList,
  ErrorState,
  Field,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
  StatusBadge,
  Textarea,
} from '../components/ui';
import { fmtDateTime, fmtNumber, fmtSigned, fmtTokens, titleCase } from '../lib/format';

/** Manual wallet credit/debit. `reason` is mandatory and lands in the audit log. */
function AdjustWalletModal({ open, onClose, userId, currentBalance }) {
  const [form, setForm] = useState({ delta: '', reason: '', idempotencyKey: '' });

  const mutation = useApiMutation({
    mutationFn: (body) => walletApi.adjust(userId, body),
    successMessage: (data) => `Wallet adjusted. New balance: ${fmtTokens(data.balance)} tokens.`,
    invalidate: [['wallet'], ['users']],
    onSuccess: () => {
      setForm({ delta: '', reason: '', idempotencyKey: '' });
      onClose();
    },
  });

  const delta = Number(form.delta || 0);
  const projected = (currentBalance ?? 0) + delta;
  const fieldErrors = mutation.error?.fieldErrors || {};

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adjust wallet balance"
      description="Writes a signed ADMIN_ADJUSTMENT ledger entry and updates the cached balance in the same transaction."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              mutation.mutate({
                delta,
                reason: form.reason,
                idempotencyKey: form.idempotencyKey || undefined,
              })
            }
            loading={mutation.isPending}
            disabled={!delta || !form.reason.trim()}
          >
            Apply adjustment
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {mutation.error && <ErrorState error={mutation.error} compact />}

        <Field
          label="Token delta"
          required
          hint="Positive credits the wallet, negative debits it."
          error={fieldErrors.delta}
        >
          <Input
            type="number"
            value={form.delta}
            onChange={(e) => setForm({ ...form, delta: e.target.value })}
            placeholder="e.g. 100 or -50"
          />
        </Field>

        {Boolean(delta) && (
          <div className="rounded-lg bg-ink-50 px-3 py-2.5 text-sm">
            <span className="text-ink-500">Balance after: </span>
            <span
              className={`font-semibold tabular ${projected < 0 ? 'text-red-600' : 'text-ink-900'}`}
            >
              {fmtTokens(projected)}
            </span>
            {projected < 0 && (
              <p className="mt-1 text-xs text-red-600">
                The API rejects an adjustment that would take a balance negative.
              </p>
            )}
          </div>
        )}

        <Field
          label="Reason"
          required
          hint="Recorded on the ledger entry and in the audit log."
          error={fieldErrors.reason}
        >
          <Textarea
            rows={3}
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            placeholder="Goodwill credit for dropped call CS-1841"
          />
        </Field>

        <Field
          label="Idempotency key"
          hint="Optional but recommended: re-submitting with the same key returns the original entry instead of adjusting twice."
          error={fieldErrors.idempotencyKey}
        >
          <Input
            value={form.idempotencyKey}
            onChange={(e) => setForm({ ...form, idempotencyKey: e.target.value })}
            placeholder="cs-1841-goodwill"
          />
        </Field>
      </div>
    </Modal>
  );
}

function BlockUserModal({ open, onClose, user }) {
  const [reason, setReason] = useState('');
  const blocking = user?.status !== 'BLOCKED';

  const mutation = useApiMutation({
    mutationFn: () => usersApi.setBlocked(user.id, { blocked: blocking, reason: reason || undefined }),
    successMessage: blocking ? 'User blocked' : 'User unblocked',
    invalidate: [['users']],
    onSuccess: () => {
      setReason('');
      onClose();
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={blocking ? 'Block this user' : 'Unblock this user'}
      description={
        blocking
          ? 'Blocking revokes every session, drops live sockets, and prevents the account from calling or being called.'
          : 'The account regains access. Their listener status, if any, is unchanged.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={blocking ? 'danger' : 'primary'}
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
          >
            {blocking ? 'Block user' : 'Unblock user'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {mutation.error && <ErrorState error={mutation.error} compact />}
        <Field label="Reason" hint="Stored in the audit log.">
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={blocking ? 'Repeated abusive behaviour' : 'Appeal accepted'}
          />
        </Field>
        {blocking && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Blocking does not touch the wallet. Any remaining balance is preserved.
          </p>
        )}
      </div>
    </Modal>
  );
}

export function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);

  const { data: user, isLoading, error, refetch } = useQuery({
    queryKey: qk.user(id),
    queryFn: () => usersApi.get(id),
  });

  const { data: wallet } = useQuery({
    queryKey: qk.wallet(id),
    queryFn: () => walletApi.get(id),
    enabled: can(P.WALLET_READ) && Boolean(id),
  });

  if (isLoading) return <LoadingBlock label="Loading user…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const balance = wallet?.balance ?? user?.wallet?.balance ?? 0;

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link
            to="/users"
            className="mb-1.5 inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-700"
          >
            <ArrowLeft className="size-3.5" />
            Back to users
          </Link>
        }
        title={user.name || 'Unnamed user'}
        description={user.mobile}
        actions={
          <>
            {can(P.WALLET_READ) && (
              <Button variant="secondary" onClick={() => navigate(`/wallets/${id}`)}>
                <Coins className="size-4" />
                Wallet &amp; ledger
              </Button>
            )}
            {can(P.WALLET_ADJUST) && (
              <Button variant="secondary" onClick={() => setAdjustOpen(true)}>
                Adjust balance
              </Button>
            )}
            {can(P.USERS_BLOCK) && (
              <Button
                variant={user.status === 'BLOCKED' ? 'primary' : 'danger'}
                onClick={() => setBlockOpen(true)}
              >
                {user.status === 'BLOCKED' ? (
                  <>
                    <ShieldCheck className="size-4" />
                    Unblock
                  </>
                ) : (
                  <>
                    <Ban className="size-4" />
                    Block
                  </>
                )}
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Account" className="lg:col-span-2">
          <DescList
            items={[
              { label: 'User id', value: user.id, mono: true, full: true },
              { label: 'Account status', value: <StatusBadge status={user.status} /> },
              {
                label: 'Mobile verified',
                value: user.mobileVerified ? 'Verified' : 'Not verified',
              },
              { label: 'Mobile', value: user.mobile },
              { label: 'Gender', value: titleCase(user.gender) },
              { label: 'Country', value: user.country },
              { label: 'Registered', value: fmtDateTime(user.createdAt) },
              { label: 'Last login', value: fmtDateTime(user.lastLoginAt) },
              user.blockedAt && { label: 'Blocked at', value: fmtDateTime(user.blockedAt) },
              user.blockedReason && {
                label: 'Blocked reason',
                value: user.blockedReason,
                full: true,
              },
            ]}
          />

          {(user.counts || user.lifetime) && (
            <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-ink-100 pt-4 sm:grid-cols-4">
              {[
                ['Calls as caller', user.counts?.callsAsCaller],
                ['Calls as listener', user.counts?.callsAsListener],
                ['Reports against', user.counts?.reportsAgainst],
                ['Payments', user.counts?.payments],
                ['Tokens earned', user.lifetime?.tokensCredited],
                ['Tokens spent', user.lifetime?.tokensDebited],
                ['Amount paid', user.lifetime?.amountPaid],
                ['Talk time (min)', user.lifetime?.talkTimeMinutes],
              ]
                .filter(([, value]) => value !== undefined && value !== null)
                .map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-ink-500">{label}</dt>
                    <dd className="mt-0.5 text-sm font-medium tabular text-ink-900">
                      {fmtNumber(value)}
                    </dd>
                  </div>
                ))}
            </dl>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Wallet">
            <p className="text-3xl font-semibold tabular text-ink-900">{fmtTokens(balance)}</p>
            <p className="mt-1 text-xs text-ink-500">tokens available</p>
            {wallet && (
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-ink-100 pt-3.5 text-xs">
                <div>
                  <dt className="text-ink-500">Total credited</dt>
                  <dd className="mt-0.5 font-medium tabular text-emerald-700">
                    {fmtSigned(wallet.totalCredited)}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-500">Total debited</dt>
                  <dd className="mt-0.5 font-medium tabular text-red-600">
                    -{fmtTokens(wallet.totalDebited)}
                  </dd>
                </div>
              </dl>
            )}
          </Card>

          <Card title="Listener profile">
            {user.listener ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-ink-700">{user.listener.displayName || '—'}</span>
                  <StatusBadge status={user.listener.status} />
                </div>

                {user.listener.status === 'APPROVED' && (
                  <p className="text-xs text-ink-500">
                    {user.listener.online ? 'Online now' : 'Offline'}
                    {user.listener.manualOffline && ' (went offline manually)'}
                  </p>
                )}

                {/* `languages` is returned at the top level, not nested on the
                    listener object. */}
                {user.languages?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {user.languages.map((l) => (
                      <Badge key={l.id || l.name} tone="brand">
                        {l.name}
                      </Badge>
                    ))}
                  </div>
                )}

                <Link
                  to={`/listeners/${user.listener.id}`}
                  className="block text-xs font-medium text-brand-600 hover:underline"
                >
                  Open application
                </Link>
              </div>
            ) : (
              <p className="text-sm text-ink-500">
                This user has not applied to be a listener. They are a caller only.
              </p>
            )}
          </Card>
        </div>
      </div>

      <AdjustWalletModal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        userId={id}
        currentBalance={balance}
      />
      <BlockUserModal open={blockOpen} onClose={() => setBlockOpen(false)} user={user} />
    </>
  );
}
