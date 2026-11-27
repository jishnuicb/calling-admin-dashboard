import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, Gift, Send } from 'lucide-react';
import { bulkTopupApi, notificationsApi, reengagementApi } from '../api/endpoints';
import { useApiMutation } from '../hooks/useApiMutation';
import { useAuth } from '../auth/AuthContext';
import { P } from '../auth/permissions';
import { Pagination } from '../components/DataTable';
import {
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  PageHeader,
  Tabs,
  Textarea,
} from '../components/ui';
import { fmtTokens, shortId } from '../lib/format';

const AUDIENCES = [
  {
    id: 'PHONE_INTL_LAST_CALL',
    label: 'Outside India, last call',
    title: 'Phone, outside India — last call was X days ago',
    description:
      'Verified phone, dial code other than +91, no Google sign-in. Latest call was on or before that day — they have not called anyone after it.',
  },
  {
    id: 'PHONE_INDIA_LAST_CALL',
    label: 'Inside India, last call',
    title: 'Phone, inside India — last call was X days ago',
    description:
      'Verified phone on +91, no Google sign-in. Latest call was on or before that day — they have not called anyone after it.',
  },
  {
    id: 'PAID_BALANCE_NO_RECENT_CALL',
    label: 'Paid balance, no recent call',
    title: 'Paid token balance — no call in the last X days',
    description:
      'At least one successful payment, wallet balance above zero, and no call after that day.',
  },
  {
    id: 'PHONE_INTL_REGISTERED_NO_CALL',
    label: 'Outside India, never called',
    title: 'Phone, outside India — registered X days ago, never called',
    description:
      'Verified phone, dial code other than +91, account created on or before that day, and no call yet.',
  },
];

function useBulkTopupWrite() {
  const { can, isSubadmin } = useAuth();
  if (isSubadmin) return false;
  return can(P.BONUSES_WRITE, P.WALLET_ADJUST);
}

export function ReengagementPage() {
  const { can } = useAuth();
  const canSend = can(P.NOTIFICATIONS_SEND);
  const canTopup = useBulkTopupWrite();

  const [audience, setAudience] = useState(AUDIENCES[0].id);
  const [days, setDays] = useState('7');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tokens, setTokens] = useState('');
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [previewOn, setPreviewOn] = useState(false);

  const spec = AUDIENCES.find((item) => item.id === audience) || AUDIENCES[0];
  const daysValue = Number(days);
  const daysOk = days !== '' && Number.isInteger(daysValue) && daysValue >= 0 && daysValue <= 3650;

  const preview = useQuery({
    queryKey: ['reengagement-preview', audience, daysValue, page, search.trim()],
    queryFn: () =>
      reengagementApi.preview({
        audience,
        days: daysValue,
        page,
        limit: 20,
        search: search.trim() || undefined,
      }),
    enabled: previewOn && daysOk,
  });

  const resetPreview = () => {
    setPreviewOn(false);
    setPage(1);
  };

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
      data?.run ? `Top-up finished — ${data.run.creditedCount} credited` : 'Top-up finished',
    invalidate: [['bulk-topup'], ['wallet']],
  });

  const rows = preview.data?.data || [];
  const meta = preview.data?.meta;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Re-engagement"
        description="Pick one group, set how many days back X is, then preview who matches before you send a push or credit tokens."
      />

      <Tabs
        tabs={AUDIENCES.map((item) => ({ id: item.id, label: item.label }))}
        active={audience}
        onChange={(id) => {
          setAudience(id);
          resetPreview();
        }}
      />

      <Card title={spec.title} description={spec.description}>
        <Field
          label="Days (X)"
          required
          hint="Calendar days before today, in the bulk-topup timezone (Asia/Kolkata unless configured otherwise)."
        >
          <Input
            type="number"
            min={0}
            max={3650}
            value={days}
            onChange={(e) => {
              setDays(e.target.value);
              resetPreview();
            }}
          />
        </Field>
      </Card>

      <Card
        title="Eligible users"
        description="Same people a push would reach. Anyone marked Excluded is on the manual top-up exclusion list and would not be credited."
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Search" hint="Name, phone, email, or public id.">
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search the preview"
              />
            </Field>
            <Button
              variant="secondary"
              disabled={!daysOk}
              loading={preview.isFetching}
              onClick={() => {
                setPage(1);
                setPreviewOn(true);
                if (previewOn) preview.refetch();
              }}
            >
              <Eye className="size-4" />
              Preview eligible users
            </Button>
          </div>
          {preview.error && <ErrorState error={preview.error} onRetry={() => preview.refetch()} />}
          {previewOn && !preview.isFetching && !preview.error && rows.length === 0 && (
            <p className="text-sm text-ink-500">No eligible users for this group and day.</p>
          )}
          {rows.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-ink-200 text-left text-sm">
                  <thead className="bg-ink-50 text-xs font-semibold text-ink-600">
                    <tr>
                      <th className="px-3 py-2.5">User</th>
                      <th className="px-3 py-2.5">Mobile</th>
                      <th className="px-3 py-2.5">Email</th>
                      <th className="px-3 py-2.5 text-right">Balance</th>
                      <th className="px-3 py-2.5">Tokens</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 bg-white">
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-3 py-2">
                          <p className="font-medium text-ink-900">{row.name || '—'}</p>
                          <p className="font-mono text-[11px] text-ink-400">
                            {row.publicId || shortId(row.id)}
                          </p>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-ink-600">
                          {row.mobile || '—'}
                        </td>
                        <td className="px-3 py-2 text-xs text-ink-600">{row.email || '—'}</td>
                        <td className="px-3 py-2 text-right text-xs">{fmtTokens(row.balance)}</td>
                        <td className="px-3 py-2 text-xs">
                          {row.topupEligible ? 'Eligible' : 'Excluded'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination meta={meta} onPageChange={setPage} />
            </>
          )}
        </div>
      </Card>

      <Card title="Push notification" description="Sends only to the selected tab. The Notifications screen is unchanged.">
        <div className="space-y-4">
          {send.error && <ErrorState error={send.error} compact />}
          <Field label="Title" required>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canSend} />
          </Field>
          <Field label="Body" required>
            <Textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={!canSend}
            />
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
        description="Credits only the selected tab. People on the manual exclusion list are still skipped. The daily automatic run and the Bulk top-up screen are unchanged."
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
