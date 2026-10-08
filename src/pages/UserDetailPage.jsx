import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Ban, Bell, Coins, Copy, Eye, EyeOff, KeyRound, ShieldCheck, Trash2 } from 'lucide-react';
import { usersApi, walletApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { useApiMutation } from '../hooks/useApiMutation';
import { useAuth } from '../auth/AuthContext';
import { P } from '../auth/permissions';
import { SendNotificationModal } from '../components/SendNotificationModal';
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

function loginMethodLabel(method) {
  if (!method) return '—';
  if (method === 'MSG91') return 'MSG91';
  if (method === 'MSG91_WHATSAPP') return 'MSG91 WhatsApp';
  if (method === 'BACKUP_OTP') return 'Backup OTP';
  return method;
}

async function copyText(value) {
  if (!value) return false;
  try {
    await navigator.clipboard.writeText(String(value));
    return true;
  } catch {
    return false;
  }
}

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

function DeleteUserModal({ open, onClose, user }) {
  const [reason, setReason] = useState('');

  const mutation = useApiMutation({
    mutationFn: () => usersApi.delete(user.id, { reason }),
    successMessage: 'User account deleted. The phone number can re-register as a new account.',
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
      title="Delete this account"
      description="Soft-deletes the account, frees the phone for a new signup, and blocks a second welcome bonus for that number. Old data stays hidden under the deleted account."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={reason.trim().length < 3}
          >
            Delete account
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {mutation.error && <ErrorState error={mutation.error} compact />}
        <Field label="Reason" required hint="Required. Stored on the account and in the audit log.">
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Support request — permanent account removal"
          />
        </Field>
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
          This cannot be undone from the admin UI. The same phone can log in again only as a brand-new
          account (no welcome bonus).
        </p>
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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [decryptKey, setDecryptKey] = useState('');
  const [revealedUser, setRevealedUser] = useState(null);
  const [copied, setCopied] = useState(false);

  const { data: user, isLoading, error, refetch } = useQuery({
    queryKey: qk.user(id),
    queryFn: () => usersApi.get(id),
  });

  const {
    data: backupOtp,
    isLoading: backupLoading,
    error: backupError,
    refetch: refetchBackup,
  } = useQuery({
    queryKey: ['users', 'backup-otp', id],
    queryFn: () => usersApi.getBackupOtp(id),
    enabled: can(P.USERS_READ) && Boolean(id),
    refetchInterval: 30_000,
  });

  const { data: wallet } = useQuery({
    queryKey: qk.wallet(id),
    queryFn: () => walletApi.get(id),
    enabled: can(P.WALLET_READ) && Boolean(id),
  });

  const generateBackup = useApiMutation({
    mutationFn: () => usersApi.generateBackupOtp(id),
    successMessage: 'Backup OTP generated',
    invalidate: [['users', 'backup-otp', id]],
  });

  useEffect(
    () => () => {
      setDecryptKey('');
      setRevealedUser(null);
    },
    [],
  );

  const revealPhone = useApiMutation({
    mutationFn: () => usersApi.revealPhone(id, { decryptionKey: decryptKey }),
    successMessage: 'Phone number revealed for this view only',
    onSuccess: (data) => setRevealedUser(data),
  });

  const remaskPhone = () => {
    setDecryptKey('');
    setRevealedUser(null);
  };

  if (isLoading) return <LoadingBlock label="Loading user…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const view = revealedUser || user;
  const balance = wallet?.balance ?? view?.wallet?.balance ?? 0;

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
        title={
          <span className="inline-flex items-center gap-3">
            {user.profilePicture ? (
              <img
                src={user.profilePicture}
                alt=""
                className="size-12 rounded-full object-cover ring-1 ring-ink-200"
              />
            ) : (
              <span className="flex size-12 items-center justify-center rounded-full bg-ink-100 text-lg font-semibold text-ink-500">
                {(user.name || '?').slice(0, 1).toUpperCase()}
              </span>
            )}
            {user.name || 'Unnamed user'}
          </span>
        }
        description={view.mobile}
        actions={
          <>
            {can(P.NOTIFICATIONS_SEND) && (
              <Button variant="secondary" onClick={() => setNotifyOpen(true)}>
                <Bell className="size-4" />
                Send notification
              </Button>
            )}
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
            {can(P.USERS_BLOCK) && user.status !== 'DELETED' && (
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
            {can(P.USERS_DELETE) && user.status !== 'DELETED' && (
              <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="size-4" />
                Delete account
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {can(P.USERS_READ) && (
          <Card
            title="Phone number"
            description="Masked by default (country code + last 2 digits). Enter the permanent decryption key to reveal."
            className="lg:col-span-3"
          >
            <div className="mb-3 space-y-2 rounded-lg border border-ink-100 bg-ink-50/60 p-3">
              <Field label="Permanent decryption key" hint="Same key as listener bank reveal. Never stored.">
                <Input
                  type="password"
                  autoComplete="off"
                  value={decryptKey}
                  onChange={(e) => setDecryptKey(e.target.value)}
                  placeholder="Enter permanent decryption key"
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  loading={revealPhone.isPending}
                  disabled={!decryptKey.trim()}
                  onClick={() => revealPhone.mutate()}
                >
                  <Eye className="size-4" />
                  Reveal phone
                </Button>
                {revealedUser && (
                  <Button size="sm" variant="secondary" onClick={remaskPhone}>
                    <EyeOff className="size-4" />
                    Remask
                  </Button>
                )}
              </div>
              {revealPhone.error && <ErrorState error={revealPhone.error} compact />}
            </div>
            <p className="font-mono text-sm text-ink-900">{view.mobile || '—'}</p>
          </Card>
        )}

        {can(P.USERS_READ) && (
          <Card
            title="Backup OTP"
            description="Support fallback code stored when MSG91 sends OTP. Used only if MSG91 verify fails. Never shown to the app."
            className="lg:col-span-3"
          >
            {backupLoading ? (
              <p className="text-sm text-ink-500">Loading backup OTP…</p>
            ) : backupError ? (
              <ErrorState error={backupError} onRetry={refetchBackup} compact />
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {backupOtp?.expired || !backupOtp?.code ? (
                      <Badge tone="danger">Expired / none</Badge>
                    ) : (
                      <Badge tone="success">Active</Badge>
                    )}
                    {backupOtp?.source && (
                      <Badge tone="neutral">
                        {backupOtp.source === 'ADMIN' ? 'Admin generated' : 'From send OTP'}
                      </Badge>
                    )}
                  </div>
                  <p className="font-mono text-2xl tracking-widest text-ink-900">
                    {backupOtp?.code || '••••••'}
                  </p>
                  <p className="text-xs text-ink-500">
                    {backupOtp?.expiresAt
                      ? `Expires ${fmtDateTime(backupOtp.expiresAt)}`
                      : 'No backup OTP issued yet'}
                    {backupOtp?.expirySeconds
                      ? ` · config ${backupOtp.expirySeconds}s`
                      : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!backupOtp?.code}
                    onClick={async () => {
                      const ok = await copyText(backupOtp?.code);
                      if (ok) {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      }
                    }}
                  >
                    <Copy className="size-4" />
                    {copied ? 'Copied' : 'Copy OTP'}
                  </Button>
                  {can(P.USERS_WRITE) && user.status !== 'DELETED' && (
                    <Button
                      size="sm"
                      loading={generateBackup.isPending}
                      onClick={() => generateBackup.mutate()}
                    >
                      <KeyRound className="size-4" />
                      {backupOtp?.expired || !backupOtp?.code
                        ? 'Generate OTP'
                        : 'Regenerate OTP'}
                    </Button>
                  )}
                </div>
              </div>
            )}
            {generateBackup.error && (
              <div className="mt-3">
                <ErrorState error={generateBackup.error} compact />
              </div>
            )}
          </Card>
        )}

        <Card title="Account" className="lg:col-span-2">
          <DescList
            items={[
              { label: 'User id', value: user.id, mono: true, full: true },
              { label: 'Account status', value: <StatusBadge status={user.status} /> },
              {
                label: 'Mobile verified',
                value: user.mobileVerified ? 'Verified' : 'Not verified',
              },
              { label: 'Mobile', value: view.mobile },
              { label: 'Gender', value: titleCase(user.gender) },
              { label: 'Country', value: user.country },
              {
                label: 'Profile picture',
                value: user.profilePicture ? (
                  <a
                    href={user.profilePicture}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-brand-600 hover:underline"
                  >
                    {user.profilePicture}
                  </a>
                ) : (
                  '—'
                ),
                full: true,
              },
              { label: 'Registered', value: fmtDateTime(user.createdAt) },
              { label: 'Last login', value: fmtDateTime(user.lastLoginAt) },
              {
                label: 'Last login via',
                value: (
                  <span className="inline-flex items-center gap-2">
                    {user.lastLoginMethod === 'BACKUP_OTP' ? (
                      <Badge tone="warning">Backup OTP</Badge>
                    ) : user.lastLoginMethod === 'MSG91_WHATSAPP' ? (
                      <Badge tone="info">MSG91 WhatsApp</Badge>
                    ) : user.lastLoginMethod === 'MSG91' ? (
                      <Badge tone="info">MSG91</Badge>
                    ) : (
                      loginMethodLabel(user.lastLoginMethod)
                    )}
                  </span>
                ),
              },
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

          <Card title="Preferred languages">
            {user.userLanguages?.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {user.userLanguages.map((l) => (
                  <Badge key={l.id || l.name} tone="brand">
                    {l.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-500">None selected</p>
            )}
          </Card>

          <Card title="Listener profile">
            {user.listener ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-sm text-ink-700">
                    {user.listener.photoUrl && (
                      <img
                        src={user.listener.photoUrl}
                        alt=""
                        className="size-8 rounded-full object-cover ring-1 ring-ink-200"
                      />
                    )}
                    {user.listener.displayName || '—'}
                  </span>
                  <StatusBadge status={user.listener.status} />
                </div>

                {user.listener.status === 'APPROVED' && (
                  <p className="text-xs text-ink-500">
                    {user.listener.online
                      ? 'Online (manual — stays online if app is closed)'
                      : user.listener.manualOffline
                        ? 'Offline (went offline manually)'
                        : 'Offline'}
                  </p>
                )}

                {/* Listener speaking languages (separate from preferred userLanguages). */}
                {user.languages?.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs text-ink-500">Listener languages</p>
                    <div className="flex flex-wrap gap-1.5">
                      {user.languages.map((l) => (
                        <Badge key={l.id || l.name} tone="brand">
                          {l.name}
                        </Badge>
                      ))}
                    </div>
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
      <SendNotificationModal
        open={notifyOpen}
        onClose={() => setNotifyOpen(false)}
        userId={id}
        userLabel={user?.name || user?.mobile || id}
      />
      <BlockUserModal open={blockOpen} onClose={() => setBlockOpen(false)} user={user} />
      <DeleteUserModal open={deleteOpen} onClose={() => setDeleteOpen(false)} user={user} />
    </>
  );
}
