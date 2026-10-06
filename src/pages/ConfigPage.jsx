import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Settings } from 'lucide-react';
import { appSettingsApi, configApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { useApiMutation } from '../hooks/useApiMutation';
import { useAuth } from '../auth/AuthContext';
import { P } from '../auth/permissions';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
  Select,
  Toggle,
} from '../components/ui';

/**
 * Human-readable context for each runtime setting.
 *
 * The API returns keys, values and types; it does not explain consequences. These
 * notes do, because several of these keys change money or call behaviour the
 * moment they are saved — `call.ratePerSecond` in particular only affects calls
 * started afterwards, since each call snapshots the rate at initiate.
 */
const CONFIG_META = {
  'call.ratePerSecond': {
    label: 'Call rate',
    unit: 'tokens per second',
    note: 'Snapshotted onto each call at initiate, so a change never re-prices a call already in progress.',
    group: 'Calling',
  },
  'call.ringTimeoutSeconds': {
    label: 'Ring timeout',
    unit: 'seconds',
    note: 'How long a call rings before it is marked missed. The sweep enforces this even if both clients disconnect.',
    group: 'Calling',
  },
  'call.minBalanceToStart': {
    label: 'Minimum balance to start a call',
    unit: 'tokens',
    note: 'Callers below this cannot initiate. Prevents a call that would end almost immediately.',
    group: 'Calling',
  },
  'listener.earnPaisePerSecond': {
    label: 'Listener earn rate',
    unit: 'paise per second',
    note: 'INR credited to the listener per second of talk time (100 paise = ₹1). Supports decimals (e.g. 6.66). Snapshotted onto each call at initiate. Amount = round(seconds × rate) in whole paise. Does not change caller token billing.',
    group: 'Listener payouts',
  },
  'payout.schedule': {
    label: 'Automatic payout schedule',
    note: 'OFF, WEEKLY, or MONTHLY. Cron creates Cashfree transfers for listeners above the minimum. Manual payouts always work from the Payouts page.',
    group: 'Listener payouts',
  },
  'payout.minAmountPaise': {
    label: 'Minimum automatic payout',
    unit: 'paise',
    note: 'Listeners below this pending balance are skipped by weekly/monthly runs. Manual payouts ignore this floor.',
    group: 'Listener payouts',
  },
  'presence.offlineGraceSeconds': {
    label: 'Presence offline grace (unused)',
    unit: 'seconds',
    note: 'Legacy setting. Online/offline is manual-only now — socket disconnect no longer flips listeners offline.',
    group: 'Calling',
  },
  'otp.resendDelayAfterFirstSeconds': {
    label: 'OTP resend wait after the 1st request',
    unit: 'seconds',
    note: 'First /otp/send is immediate; wait before another preflight (MSG91 widget sends the SMS). Also editable from OTP & lockouts.',
    group: 'OTP & verification',
  },
  'otp.resendDelayAfterSecondSeconds': {
    label: 'OTP resend wait after the 2nd request',
    unit: 'seconds',
    note: 'Applies to the third request and any beyond it, so raising the attempt limit still throttles.',
    group: 'OTP & verification',
  },
  'otp.maxRequestsBeforeLock': {
    label: 'OTP requests before lock',
    unit: 'requests',
    note: 'Once this many /otp/send preflights succeed the number is locked. An admin can unlock it under OTP & lockouts; a successful widget verify also clears the lock and the counter.',
    group: 'OTP & verification',
  },
  'discovery.defaultLanguage': {
    label: 'Default discovery language',
    note: 'Applied when a caller browses listeners without choosing a language. Must match a language name in the master list, or no default is applied.',
    group: 'Discovery',
  },
  'bonus.welcome.enabled': {
    label: 'Welcome bonus enabled',
    note: 'Grants tokens once per user on first verification. Idempotent, so it cannot be claimed twice.',
    group: 'Bonuses',
  },
  'bonus.welcome.tokens': {
    label: 'Welcome bonus amount',
    unit: 'tokens',
    note: 'Applies to users who verify after the change; already-granted bonuses are untouched.',
    group: 'Bonuses',
  },
  'bonus.weekly.enabled': {
    label: 'User weekly bonus enabled',
    note: 'Caller talk-time weekly bonus. Prefer Bonuses → Weekly settings for edits.',
    group: 'Bonuses',
  },
  'bonus.weekly.targetMinutes': {
    label: 'User weekly target',
    unit: 'minutes',
    note: 'Talk time a caller must reach in the period to qualify.',
    group: 'Bonuses',
  },
  'bonus.weekly.rewardTokens': {
    label: 'User weekly reward',
    unit: 'tokens',
    note: 'Granted to each qualifying caller when the run completes.',
    group: 'Bonuses',
  },
  'bonus.weekly.listener.enabled': {
    label: 'Listener weekly bonus enabled',
    note: 'Listener talk-time weekly bonus (separate from users).',
    group: 'Bonuses',
  },
  'bonus.weekly.listener.targetMinutes': {
    label: 'Listener weekly target',
    unit: 'minutes',
    note: 'Talk time a listener must reach in the period to qualify.',
    group: 'Bonuses',
  },
  'bonus.weekly.listener.rewardTokens': {
    label: 'Listener weekly reward',
    unit: 'tokens',
    note: 'Granted to each qualifying listener when the run completes.',
    group: 'Bonuses',
  },
  'bulk.topup.enabled': {
    label: 'Daily bulk wallet top-up enabled',
    note: 'When on, the 12:30 AM cron credits eligible ACTIVE users. Prefer Money → Bulk top-up.',
    group: 'Bonuses',
  },
  'bulk.topup.tokens': {
    label: 'Bulk top-up tokens per user',
    unit: 'tokens',
    note: 'Default amount for automatic and manual bulk runs (manual can override). Also the previous-day spend threshold when that gate is on.',
    group: 'Bonuses',
  },
  'bulk.topup.excludeListeners': {
    label: 'Bulk top-up exclude listeners',
    note: 'When on, approved listeners never receive automatic or manual bulk top-up tokens.',
    group: 'Bonuses',
  },
  'bulk.topup.requirePreviousDaySpend': {
    label: 'Bulk top-up require previous-day spend',
    note: 'Automatic only: credit only if CALL_DEDUCTION spend on the previous calendar day (job timezone) is ≥ tokens per user. Manual runs ignore this.',
    group: 'Bonuses',
  },
  'demand.notify.enabled': {
    label: 'Demand notify enabled',
    note: 'When on, the background job can push offline callers/listeners when supply/demand is imbalanced. Turn off to pause all demand pushes without redeploying.',
    group: 'Demand notify',
  },
  'demand.notify.intervalMs': {
    label: 'Demand notify interval',
    unit: 'milliseconds',
    note: 'How often the job checks counts and may send pushes. Default 120000 (2 minutes). Min 30000, max 3600000. Changes apply within ~15 seconds — no server restart.',
    group: 'Demand notify',
  },
  'demand.notify.cooldownSeconds': {
    label: 'Per-user cooldown',
    unit: 'seconds',
    note: 'Same user will not get another demand push until this many seconds pass. Default 1800 (30 minutes).',
    group: 'Demand notify',
  },
  'demand.notify.batchSize': {
    label: 'Max recipients per tick',
    unit: 'users',
    note: 'Upper bound of offline users notified in one tick (random rotation among eligible). Default 25.',
    group: 'Demand notify',
  },
  'demand.notify.minListedForCallers': {
    label: 'Min listed listeners (exclusive) to notify callers',
    unit: 'listeners',
    note: 'Rule A: notify offline callers when listed listeners is greater than this AND free ratio is high enough. Default 4 (so need 5+ listed).',
    group: 'Demand notify',
  },
  'demand.notify.freeRatio': {
    label: 'Free-listener ratio to notify callers',
    unit: '0–1',
    note: 'Rule A: free / listed must be ≥ this (0.5 = 50% free). Busy listeners do not count as free.',
    group: 'Demand notify',
  },
  'demand.notify.minCallersForListeners': {
    label: 'Min online callers (exclusive) to notify listeners',
    unit: 'callers',
    note: 'Rule B: notify offline free listeners when discovery callers > this AND there are no free listed listeners. Default 2.',
    group: 'Demand notify',
  },
  'listener.notifyCaller.cooldownSeconds': {
    label: 'Notify-caller cooldown',
    unit: 'seconds',
    note: 'After a listener notifies any past caller from call history, they must wait this many seconds before notifying again (same or another user). Default 60 (1 minute). Min 10, max 3600.',
    group: 'Listener notify',
  },
  'listener.notifyCaller.maxPerCallerPerDay': {
    label: 'Max notifies to same caller / day',
    unit: 'per UTC day',
    note: 'How many times one listener may notify the same caller in one UTC calendar day. Default 5. Min 1, max 100.',
    group: 'Listener notify',
  },
  'listener.notifyCaller.maxPerListenerPerDay': {
    label: 'Max notifies from listener / day',
    unit: 'per UTC day',
    note: 'Total notify-caller pushes one listener may send to any callers in one UTC calendar day. Default 10. Min 1, max 500.',
    group: 'Listener notify',
  },
  'listener.onlinePing.enabled': {
    label: 'Listener online ping enabled',
    note: 'Hybrid: socket-connected online listeners use continuous websocket time (no FCM). Online + no socket get FCM pings; ACK credits min(interval, time since last credited end). Missed ACKs credit nothing.',
    group: 'Listener online ping',
  },
  'listener.onlinePing.intervalMs': {
    label: 'Online ping interval',
    unit: 'milliseconds',
    note: 'Ping cadence for online listeners with no socket, and max seconds credited per ACK (default 1800000 = 30 min). If the gap since last credited time is smaller, only that difference is added. Socket-connected listeners are skipped.',
    group: 'Listener online ping',
  },
  'listener.onlinePing.ackTimeoutMs': {
    label: 'Online ping ACK timeout',
    unit: 'milliseconds',
    note: 'How long a no-socket online listener has to POST /listener/online-ack before the chunk is forfeited. Default 300000 (5 min). Min 5000, max 600000.',
    group: 'Listener online ping',
  },
  'security.ipBlock.enabled': {
    label: 'IP block enabled',
    note: 'When on, IPs that exceed rate/OTP limits are auto-blocked (and manual blocks apply). Blocked IPs get 403 IP_BLOCKED on API and socket.',
    group: 'IP security',
  },
  'security.ipBlock.rateWindowMs': {
    label: 'IP request window',
    unit: 'milliseconds',
    note: 'Window for counting non-admin API requests per IP. Default 60000 (1 min).',
    group: 'IP security',
  },
  'security.ipBlock.rateMax': {
    label: 'IP request max',
    note: 'Max non-admin API requests per IP in the window before auto RATE_LIMIT block. Default 120.',
    group: 'IP security',
  },
  'security.ipBlock.otpMax': {
    label: 'OTP sends per IP max',
    note: 'Max OTP send attempts from one IP (any mobile numbers) in the OTP window before OTP_ABUSE block. Default 15.',
    group: 'IP security',
  },
  'security.ipBlock.otpUniqueMobilesMax': {
    label: 'OTP unique mobiles per IP',
    note: 'Max distinct phone numbers an IP may OTP in the window before OTP_SPRAY block. Default 5.',
    group: 'IP security',
  },
  'security.ipBlock.otpWindowMs': {
    label: 'OTP IP window',
    unit: 'milliseconds',
    note: 'Window for OTP-per-IP and unique-mobile counting. Default 900000 (15 min).',
    group: 'IP security',
  },
  'security.ipBlock.banTtlSeconds': {
    label: 'Auto-ban duration',
    unit: 'seconds',
    note: 'How long auto-blocks last (0 = until admin unblocks). Default 3600 (1 hour). Manual blocks default to until unblock.',
    group: 'IP security',
  },
};

/** Edited in the dedicated App & support card — hide from the generic list. */
const APP_SETTINGS_KEYS = new Set([
  'app.version.major',
  'app.version.minor',
  'app.version.patch',
  'app.releaseType',
  'company.whatsappNumber',
  'company.supportEmail',
  'payment.mode',
]);

function AppSettingsCard({ writable }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.appSettings,
    queryFn: () => appSettingsApi.get(),
  });

  const [major, setMajor] = useState(1);
  const [minor, setMinor] = useState(0);
  const [patch, setPatch] = useState(0);
  const [releaseType, setReleaseType] = useState('MINOR');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [paymentMode, setPaymentMode] = useState('SANDBOX');

  useEffect(() => {
    if (!data) return;
    setMajor(data.version?.major ?? 1);
    setMinor(data.version?.minor ?? 0);
    setPatch(data.version?.patch ?? 0);
    setReleaseType(data.version?.releaseType || 'MINOR');
    setWhatsappNumber(data.whatsappNumber || '');
    setSupportEmail(data.supportEmail || '');
    setPaymentMode(data.payment?.mode || 'SANDBOX');
  }, [data]);

  const mutation = useApiMutation({
    mutationFn: () =>
      appSettingsApi.update({
        major: Number(major),
        minor: Number(minor),
        patch: Number(patch),
        releaseType,
        whatsappNumber: whatsappNumber.trim(),
        supportEmail: supportEmail.trim(),
        paymentMode,
      }),
    successMessage: 'App settings saved',
    invalidate: [qk.appSettings, qk.config],
  });

  if (isLoading) return <LoadingBlock label="Loading app settings…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const label = `${Number(major) || 0}.${Number(minor) || 0}.${Number(patch) || 0}`;
  const dirty =
    Number(major) !== (data.version?.major ?? 1) ||
    Number(minor) !== (data.version?.minor ?? 0) ||
    Number(patch) !== (data.version?.patch ?? 0) ||
    releaseType !== (data.version?.releaseType || 'MINOR') ||
    whatsappNumber.trim() !== (data.whatsappNumber || '') ||
    supportEmail.trim() !== (data.supportEmail || '') ||
    paymentMode !== (data.payment?.mode || 'SANDBOX');

  return (
    <Card
      title="App version, support contact & payments"
      description="Shown to the mobile app via GET /app/settings. Edit without a redeploy."
      actions={
        writable ? (
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={!dirty}>
            Save app settings
          </Button>
        ) : null
      }
    >
      <div className="space-y-5">
        {mutation.error && <ErrorState error={mutation.error} compact />}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">
            App release
          </p>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Major" required>
              <Input
                type="number"
                min={0}
                step={1}
                value={major}
                disabled={!writable}
                onChange={(e) => setMajor(e.target.value)}
              />
            </Field>
            <Field label="Minor" required>
              <Input
                type="number"
                min={0}
                step={1}
                value={minor}
                disabled={!writable}
                onChange={(e) => setMinor(e.target.value)}
              />
            </Field>
            <Field label="Patch" required>
              <Input
                type="number"
                min={0}
                step={1}
                value={patch}
                disabled={!writable}
                onChange={(e) => setPatch(e.target.value)}
              />
            </Field>
            <Field label="Release type" required>
              <Select
                value={releaseType}
                disabled={!writable}
                onChange={(e) => setReleaseType(e.target.value)}
              >
                <option value="MAJOR">MAJOR</option>
                <option value="MINOR">MINOR</option>
                <option value="PATCH">PATCH</option>
              </Select>
            </Field>
          </div>
          <p className="mt-2 text-xs text-ink-500">
            Current label: <span className="font-medium tabular text-ink-800">{label}</span>
            {data.version?.label && data.version.label !== label ? (
              <span className="text-ink-400"> (saved as {data.version.label})</span>
            ) : null}
          </p>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">
            Support contact
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="WhatsApp number"
              hint="Include country code. Flutter opens wa.me from this value."
            >
              <Input
                type="tel"
                placeholder="+91 98765 43210"
                value={whatsappNumber}
                disabled={!writable}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                maxLength={32}
              />
            </Field>
            <Field
              label="Support email"
              hint="Shown when OTP is locked (OTP_LOCKED) and on GET /app/settings."
            >
              <Input
                type="email"
                placeholder="support@example.com"
                value={supportEmail}
                disabled={!writable}
                onChange={(e) => setSupportEmail(e.target.value)}
                maxLength={200}
              />
            </Field>
          </div>
          {data.whatsappLink && (
            <p className="mt-2 text-xs text-ink-500">
              WhatsApp link:{' '}
              <a
                className="font-medium text-brand-700 underline"
                href={data.whatsappLink}
                target="_blank"
                rel="noreferrer"
              >
                {data.whatsappLink}
              </a>
            </p>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">
            Payment settings
          </p>
          <Field
            label="Payment mode"
            required
            hint="SANDBOX for test payments, LIVE for production. Default is SANDBOX."
          >
            <Select
              value={paymentMode}
              disabled={!writable}
              onChange={(e) => setPaymentMode(e.target.value)}
            >
              <option value="SANDBOX">SANDBOX</option>
              <option value="LIVE">LIVE</option>
            </Select>
          </Field>
        </div>
      </div>
    </Card>
  );
}

function EditConfigModal({ entry, onClose }) {
  const isBoolean = typeof entry.value === 'boolean' || entry.type === 'boolean';
  // Some settings are genuinely textual (the default discovery language), so the
  // editor cannot assume a number - coercing one would save NaN.
  const isText = !isBoolean && (typeof entry.value === 'string' || entry.type === 'string');
  const [value, setValue] = useState(entry.value);
  const [description, setDescription] = useState(entry.description || '');

  const coercedValue = () => {
    if (isBoolean) return Boolean(value);
    if (isText) return String(value);
    return Number(value);
  };

  const mutation = useApiMutation({
    mutationFn: () =>
      configApi.set({
        key: entry.key,
        // The backend coerces to the type of the environment default, so sending
        // a numeric string is safe - but sending the right type is clearer.
        value: coercedValue(),
        description: description || undefined,
      }),
    successMessage: `${entry.key} updated`,
    invalidate: [qk.config],
    onSuccess: onClose,
  });

  const meta = CONFIG_META[entry.key] || {};
  const changed = String(value) !== String(entry.value);

  return (
    <Modal
      open
      onClose={onClose}
      title={meta.label || entry.key}
      description={entry.key}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!changed && !description}
          >
            Save setting
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {mutation.error && <ErrorState error={mutation.error} compact />}

        {isBoolean ? (
          <div className="rounded-lg bg-ink-50 px-3.5 py-3">
            <Toggle
              checked={Boolean(value)}
              onChange={setValue}
              label={Boolean(value) ? 'Enabled' : 'Disabled'}
            />
          </div>
        ) : (
          <Field label="Value" required hint={meta.unit}>
            <Input
              autoFocus
              type={isText ? 'text' : 'number'}
              step={isText ? undefined : 'any'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </Field>
        )}

        {meta.note && (
          <p className="rounded-lg bg-brand-50 px-3.5 py-2.5 text-xs text-brand-900">{meta.note}</p>
        )}

        <Field label="Description" hint="Optional note stored alongside the value.">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>

        {changed && (
          <div className="rounded-lg bg-ink-50 px-3.5 py-2.5 text-sm">
            <span className="text-ink-500">Changing from </span>
            <span className="font-medium tabular text-ink-900">{String(entry.value)}</span>
            <span className="text-ink-500"> to </span>
            <span className="font-medium tabular text-ink-900">{String(value)}</span>
          </div>
        )}

        <p className="text-xs text-ink-500">
          Runtime settings are cached in-process for a few seconds, so a change can take a moment to
          be visible on every server instance.
        </p>
      </div>
    </Modal>
  );
}

export function ConfigPage() {
  const { can } = useAuth();
  const [editing, setEditing] = useState(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.config,
    queryFn: () => configApi.list(),
  });

  if (isLoading) return <LoadingBlock label="Loading configuration…" />;
  if (error) {
    return (
      <>
        <PageHeader title="Configuration" />
        <ErrorState error={error} onRetry={refetch} />
      </>
    );
  }

  const entries = (data?.data || data || []).filter((entry) => !APP_SETTINGS_KEYS.has(entry.key));
  const writable = can(P.CONFIG_WRITE);

  // Group by the meta table so related settings sit together.
  const groups = entries.reduce((acc, entry) => {
    const group = CONFIG_META[entry.key]?.group || 'Other';
    (acc[group] = acc[group] || []).push(entry);
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title="Configuration"
        description="Runtime settings, editable without a deployment. Environment variables provide the defaults; a value saved here overrides them."
      />

      {!writable && (
        <div className="mb-4 rounded-lg border border-ink-200 bg-white px-4 py-3 text-sm text-ink-600">
          You have read-only access to configuration.
        </div>
      )}

      <div className="mb-4">
        <AppSettingsCard writable={writable} />
      </div>

      <div className="space-y-4">
        {Object.entries(groups).map(([group, groupEntries]) => (
          <Card key={group} title={group} bodyClassName="divide-y divide-ink-100 px-2">
            {groupEntries.map((entry) => {
              const meta = CONFIG_META[entry.key] || {};
              const isBoolean = typeof entry.value === 'boolean';

              return (
                <div
                  key={entry.key}
                  className="flex flex-wrap items-start justify-between gap-4 px-2 py-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-ink-900">{meta.label || entry.key}</p>
                      <code className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-[11px] text-ink-600">
                        {entry.key}
                      </code>
                      {entry.isOverridden && <Badge tone="brand">overridden</Badge>}
                    </div>
                    <p className="mt-1 max-w-2xl text-xs text-ink-500">
                      {meta.note || entry.description}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      {isBoolean ? (
                        <Badge tone={entry.value ? 'success' : 'neutral'}>
                          {entry.value ? 'Enabled' : 'Disabled'}
                        </Badge>
                      ) : (
                        <>
                          <p className="text-lg font-semibold tabular text-ink-900">
                            {String(entry.value)}
                          </p>
                          {meta.unit && <p className="text-[11px] text-ink-500">{meta.unit}</p>}
                        </>
                      )}
                    </div>
                    {writable && (
                      <Button size="sm" variant="secondary" onClick={() => setEditing(entry)}>
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </Card>
        ))}

        {entries.length === 0 && (
          <Card>
            <div className="py-8 text-center">
              <Settings className="mx-auto mb-3 size-6 text-ink-400" />
              <p className="text-sm text-ink-600">
                No configuration rows found. Run the backend seed to install the defaults.
              </p>
            </div>
          </Card>
        )}
      </div>

      {editing && <EditConfigModal entry={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
