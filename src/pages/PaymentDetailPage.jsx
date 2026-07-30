import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Undo2 } from 'lucide-react';
import { paymentsApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { useApiMutation } from '../hooks/useApiMutation';
import { useAuth } from '../auth/AuthContext';
import { P } from '../auth/permissions';
import {
  Button,
  Card,
  DescList,
  ErrorState,
  Field,
  Input,
  JsonBlock,
  LoadingBlock,
  Modal,
  PageHeader,
  StatusBadge,
  Textarea,
} from '../components/ui';
import { fmtDateTime, fmtMoney, fmtTokens } from '../lib/format';

function RefundModal({ payment, onClose }) {
  const maxRefundable = (payment.amount || 0) - (payment.refundAmount || 0);
  const [form, setForm] = useState({ amount: '', reason: '' });

  const mutation = useApiMutation({
    mutationFn: () =>
      paymentsApi.refund(payment.id, {
        amount: form.amount ? Number(form.amount) : undefined,
        reason: form.reason,
      }),
    successMessage: 'Refund requested with Cashfree',
    invalidate: [['payments'], ['dashboard']],
    onSuccess: onClose,
  });

  const fieldErrors = mutation.error?.fieldErrors || {};

  return (
    <Modal
      open
      onClose={onClose}
      title="Refund this payment"
      description="Calls the Cashfree refund API. The refund is asynchronous — the status moves to REFUND_PENDING until Cashfree confirms."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!form.reason.trim()}
          >
            Request refund
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {mutation.error && <ErrorState error={mutation.error} compact />}

        <div className="rounded-lg bg-ink-50 px-3.5 py-3 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-500">Paid</span>
            <span className="font-medium tabular">{fmtMoney(payment.amount, payment.currency)}</span>
          </div>
          {payment.refundAmount > 0 && (
            <div className="mt-1 flex justify-between">
              <span className="text-ink-500">Already refunded</span>
              <span className="font-medium tabular text-amber-700">
                {fmtMoney(payment.refundAmount, payment.currency)}
              </span>
            </div>
          )}
          <div className="mt-1 flex justify-between border-t border-ink-200 pt-1">
            <span className="text-ink-500">Refundable</span>
            <span className="font-semibold tabular">
              {fmtMoney(maxRefundable, payment.currency)}
            </span>
          </div>
        </div>

        <Field
          label="Amount"
          hint="Leave blank for a full refund of the remaining amount."
          error={fieldErrors.amount}
        >
          <Input
            type="number"
            step="0.01"
            max={maxRefundable}
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder={String(maxRefundable)}
          />
        </Field>

        <Field label="Reason" required error={fieldErrors.reason}>
          <Textarea
            rows={3}
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            placeholder="Duplicate charge reported by the user"
          />
        </Field>
      </div>
    </Modal>
  );
}

export function PaymentDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const [refundOpen, setRefundOpen] = useState(false);

  const { data: payment, isLoading, error, refetch } = useQuery({
    queryKey: qk.payment(id),
    queryFn: () => paymentsApi.get(id),
  });

  if (isLoading) return <LoadingBlock label="Loading payment…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const refundable =
    can(P.PAYMENTS_REFUND) &&
    payment.status === 'SUCCESS' &&
    (payment.amount || 0) - (payment.refundAmount || 0) > 0;

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link
            to="/payments"
            className="mb-1.5 inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-700"
          >
            <ArrowLeft className="size-3.5" />
            Back to payments
          </Link>
        }
        title={payment.transactionRef}
        description={`${fmtMoney(payment.amount, payment.currency)} · ${fmtTokens(payment.tokens)} tokens`}
        actions={
          refundable && (
            <Button variant="danger" onClick={() => setRefundOpen(true)}>
              <Undo2 className="size-4" />
              Refund
            </Button>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Transaction" className="lg:col-span-2">
          <DescList
            items={[
              { label: 'Status', value: <StatusBadge status={payment.status} /> },
              {
                label: 'Wallet credited',
                value: payment.walletCreditedAt ? (
                  fmtDateTime(payment.walletCreditedAt)
                ) : (
                  <span className="text-ink-500">Never — no tokens were moved</span>
                ),
              },
              { label: 'Our reference', value: payment.transactionRef, mono: true },
              { label: 'Cashfree order id', value: payment.cfOrderId, mono: true },
              { label: 'Cashfree payment id', value: payment.cfPaymentId, mono: true },
              { label: 'Payment method', value: payment.paymentMethod },
              { label: 'Amount', value: fmtMoney(payment.amount, payment.currency) },
              { label: 'Currency', value: payment.currency },
              { label: 'Tokens', value: fmtTokens(payment.tokens) },
              { label: 'Bonus tokens', value: fmtTokens(payment.bonusTokens) },
              { label: 'Created', value: fmtDateTime(payment.createdAt) },
              { label: 'Updated', value: fmtDateTime(payment.updatedAt) },
            ]}
          />
        </Card>

        <div className="space-y-4">
          <Card title="User">
            {payment.user ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-ink-900">{payment.user.name || 'Unnamed'}</p>
                <p className="text-xs text-ink-500 tabular">
                  {payment.user.countryCode} {payment.user.mobileNumber}
                </p>
                <Link
                  to={`/users/${payment.userId}`}
                  className="block text-xs font-medium text-brand-600 hover:underline"
                >
                  Open user account
                </Link>
              </div>
            ) : (
              <p className="font-mono text-xs text-ink-600">{payment.userId}</p>
            )}
          </Card>

          {payment.package && (
            <Card title="Package">
              <p className="text-sm font-medium text-ink-900">{payment.package.name}</p>
              <p className="mt-1 text-xs text-ink-500">
                {fmtTokens(payment.package.tokens)} tokens
                {payment.package.bonusTokens > 0 &&
                  ` + ${fmtTokens(payment.package.bonusTokens)} bonus`}
              </p>
              <p className="mt-2 text-xs text-ink-500">
                Prices are snapshotted at order time, so editing the package never rewrites this.
              </p>
            </Card>
          )}

          {(payment.refundAmount > 0 || payment.refundReason) && (
            <Card title="Refund">
              <DescList
                columns={1}
                items={[
                  {
                    label: 'Refunded amount',
                    value: fmtMoney(payment.refundAmount, payment.currency),
                  },
                  { label: 'Refund id', value: payment.refundId, mono: true },
                  { label: 'Reason', value: payment.refundReason },
                  { label: 'Refunded at', value: fmtDateTime(payment.refundedAt) },
                ]}
              />
            </Card>
          )}
        </div>

        {payment.webhookPayload && (
          <Card
            title="Raw webhook payload"
            description="Stored verbatim. The signature is computed over these exact bytes."
            className="lg:col-span-3"
          >
            <JsonBlock value={payment.webhookPayload} />
          </Card>
        )}
      </div>

      {refundOpen && <RefundModal payment={payment} onClose={() => setRefundOpen(false)} />}
    </>
  );
}
