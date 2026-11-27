import { useState } from 'react';
import { Gift, Send } from 'lucide-react';
import { bulkTopupApi, notificationsApi } from '../api/endpoints';
import { useApiMutation } from '../hooks/useApiMutation';
import { useAuth } from '../auth/AuthContext';
import { P } from '../auth/permissions';
import { Button, Card, ErrorState, Field, Input, PageHeader, Textarea } from '../components/ui';

const AUDIENCES = {
  PHONE_INTL_LAST_CALL: {
    title: 'Phone, outside India — last call was X days ago',
    description:
      'Verified phone, dial code other than +91, no Google sign-in, and their latest call falls on that calendar day.',
  },
  PHONE_INDIA_LAST_CALL: {
    title: 'Phone, inside India — last call was X days ago',
    description:
      'Verified phone on +91, no Google sign-in, and their latest call falls on that calendar day.',
  },
  PAID_BALANCE_NO_RECENT_CALL: {
    title: 'Paid token balance — no call in the last X days',
    description:
      'At least one successful payment, wallet balance above zero, and no call since the start of that day.',
  },
  PHONE_INTL_REGISTERED_NO_CALL: {
    title: 'Phone, outside India — registered X days ago, never called',
    description:
      'Verified phone, dial code other than +91, account created on that calendar day, and no call yet.',
  },
};

function useBulkTopupWrite() {
  const { can, isSubadmin } = useAuth();
  if (isSubadmin) return false;
  return can(P.BONUSES_WRITE, P.WALLET_ADJUST);
}

function ReengagementPage({ audience }) {
  const spec = AUDIENCES[audience];
  const { can } = useAuth();
  const canSend = can(P.NOTIFICATIONS_SEND);
  const canTopup = useBulkTopupWrite();

  const [days, setDays] = useState('7');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tokens, setTokens] = useState('');
  const [note, setNote] = useState('');

  const daysValue = Number(days);
  const daysOk = days !== '' && Number.isInteger(daysValue) && daysValue >= 0 && daysValue <= 3650;

  const send = useApiMutation({
    mutationFn: () =>
      notificationsApi.send({
        audience,
        days: daysValue,
        channel: 'PUSH',
        title: title.trim(),
        body: body.trim(),
      }),
    successMessage: (data) =>
      `Notification sent — ${data.targeted ?? 0} targeted, ${data.sent ?? 0} delivered`,
  });

  const topup = useApiMutation({
    mutationFn: () =>
      bulkTopupApi.runManual({
        audience,
        days: daysValue,
        ...(tokens !== '' ? { tokensPerUser: Number(tokens) } : {}),
        note: note.trim() || undefined,
      }),
    successMessage: (data) =>
      data?.run
        ? `Top-up finished — ${data.run.creditedCount} credited`
        : 'Top-up finished',
    invalidate: [['bulk-topup'], ['wallet']],
  });

  return (
    <div className="space-y-4">
      <PageHeader title={spec.title} description={spec.description} />

      <Card title="Days (X)" description="Calendar days before today, in the bulk-topup timezone (Asia/Kolkata unless configured otherwise).">
        <Field label="Days (X)" required>
          <Input
            type="number"
            min={0}
            max={3650}
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
        </Field>
      </Card>

      <Card title="Push notification" description="Sends only to this group. The Notifications screen is unchanged.">
        <div className="space-y-4">
          {send.error && <ErrorState error={send.error} compact />}
          <Field label="Title" required>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canSend} />
          </Field>
          <Field label="Body" required>
            <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} disabled={!canSend} />
          </Field>
          <Button
            disabled={!canSend || !daysOk || !title.trim() || !body.trim()}
            loading={send.isPending}
            onClick={() => send.mutate()}
          >
            <Send className="size-4" />
            Send push
          </Button>
          {!canSend && (
            <p className="text-xs text-amber-700">
              You need <code>notifications:send</code> to send this push.
            </p>
          )}
        </div>
      </Card>

      <Card
        title="Bulk token top-up"
        description="Credits only this group. People on the manual exclusion list are still skipped. The daily automatic run and the Bulk top-up screen are unchanged."
      >
        <div className="space-y-4">
          {topup.error && <ErrorState error={topup.error} compact />}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tokens per user" hint="Leave blank to use the saved bulk top-up amount.">
              <Input
                type="number"
                min={1}
                value={tokens}
                disabled={!canTopup}
                onChange={(e) => setTokens(e.target.value)}
              />
            </Field>
            <Field label="Note (optional)">
              <Input
                value={note}
                maxLength={500}
                disabled={!canTopup}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
          </div>
          <Button
            variant="secondary"
            disabled={!canTopup || !daysOk || (tokens !== '' && !(Number(tokens) >= 1))}
            loading={topup.isPending}
            onClick={() => topup.mutate()}
          >
            <Gift className="size-4" />
            Credit tokens
          </Button>
          {!canTopup && (
            <p className="text-xs text-amber-700">
              You need <code>bonuses:write</code> or <code>wallet:adjust</code> to credit tokens.
              Subadmins cannot run a top-up.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

export function PhoneIntlLastCallPage() {
  return <ReengagementPage audience="PHONE_INTL_LAST_CALL" />;
}

export function PhoneIndiaLastCallPage() {
  return <ReengagementPage audience="PHONE_INDIA_LAST_CALL" />;
}

export function PaidBalanceIdlePage() {
  return <ReengagementPage audience="PAID_BALANCE_NO_RECENT_CALL" />;
}

export function PhoneIntlNeverCalledPage() {
  return <ReengagementPage audience="PHONE_INTL_REGISTERED_NO_CALL" />;
}
