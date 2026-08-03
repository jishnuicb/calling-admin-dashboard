import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, PhoneOff } from 'lucide-react';
import { callsApi } from '../api/endpoints';
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
  JsonBlock,
  LoadingBlock,
  Modal,
  PageHeader,
  StatusBadge,
  Textarea,
} from '../components/ui';
import { fmtDateTimeSeconds, fmtDuration, fmtTokens, shortId } from '../lib/format';

const LIVE_STATUSES = ['RINGING', 'ACTIVE'];

function TerminateModal({ call, onClose }) {
  const [reason, setReason] = useState('');

  const mutation = useApiMutation({
    mutationFn: () => callsApi.terminate(call.id, { reason }),
    successMessage: 'Call terminated',
    invalidate: [['calls'], ['dashboard'], ['wallet']],
    onSuccess: onClose,
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Force-terminate this call"
      description="Uses the same settlement path as a normal hangup, so the caller is billed only for the elapsed seconds."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!reason.trim()}
          >
            Terminate call
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {mutation.error && <ErrorState error={mutation.error} compact />}
        <Field label="Reason" required hint="Recorded on the session and in the audit log.">
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Abuse reported by the listener mid-call"
          />
        </Field>
        <p className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">
          Terminating is idempotent — if the sweep or a participant ends the call first, this
          reports the existing outcome rather than billing twice.
        </p>
      </div>
    </Modal>
  );
}

export function CallDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const [terminateOpen, setTerminateOpen] = useState(false);

  const { data: call, isLoading, error, refetch } = useQuery({
    queryKey: qk.call(id),
    queryFn: () => callsApi.get(id),
    // A live call's consumption moves; poll while it is in flight.
    refetchInterval: (query) =>
      LIVE_STATUSES.includes(query.state.data?.status) ? 5_000 : false,
  });

  if (isLoading) return <LoadingBlock label="Loading call…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const isLive = LIVE_STATUSES.includes(call.status);


  console.log('CALL DETAIL DATA:', call);
  console.log('CALLER:', call.caller);
  console.log('LISTENER:', call.listener);
  console.log('CALLER ID:', call.callerId);
  console.log('LISTENER ID:', call.listenerId);

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link
            to="/calls"
            className="mb-1.5 inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-700"
          >
            <ArrowLeft className="size-3.5" />
            Back to calls
          </Link>
        }
        title="Call session"
        description={call.channelName}
        actions={
          isLive &&
          can(P.CALLS_TERMINATE) && (
            <Button variant="danger" onClick={() => setTerminateOpen(true)}>
              <PhoneOff className="size-4" />
              Force-terminate
            </Button>
          )
        }
      />

      {isLive && (
        <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3">
          <span className="size-2 animate-pulse rounded-full bg-sky-500" />
          <p className="text-sm text-sky-900">
            This call is {call.status.toLowerCase()}. Consumption below is a projection from{' '}
            <span className="font-mono text-xs">startedAt</span> and refreshes every 5 seconds. The
            wallet is debited once, at settlement.
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Session" className="lg:col-span-2">
          <DescList
            items={[
              { label: 'Status', value: <StatusBadge status={call.status} /> },
              { label: 'Call type', value: <Badge tone="brand">{call.callType}</Badge> },
              { label: 'Session id', value: call.id, mono: true },
              { label: 'Channel', value: call.channelName, mono: true },
              {
                label: 'Rate per second',
                value: `${call.ratePerSecond} tokens/s`,
              },
              {
                label: 'Caller balance at start',
                value: call.callerBalanceAtStart != null ? fmtTokens(call.callerBalanceAtStart) : null,
              },
              { label: 'Initiated', value: fmtDateTimeSeconds(call.initiatedAt) },
              { label: 'Ring deadline', value: fmtDateTimeSeconds(call.ringTimeoutAt) },
              { label: 'Answered', value: fmtDateTimeSeconds(call.answeredAt) },
              {
                label: 'Billing started',
                value: fmtDateTimeSeconds(call.startedAt),
              },
              { label: 'Ended', value: fmtDateTimeSeconds(call.endedAt) },
              { label: 'Last billed', value: fmtDateTimeSeconds(call.lastBilledAt) },
              {
                label: 'End reason',
                value: call.endReason ? (
                  <Badge tone={call.endReason === 'INSUFFICIENT_BALANCE' ? 'warning' : 'neutral'}>
                    {call.endReason.replace(/_/g, ' ').toLowerCase()}
                  </Badge>
                ) : null,
              },
              { label: 'Ended by', value: call.endedByRole },
            ]}
          />
        </Card>

        <div className="space-y-4">
          <Card title={isLive ? 'Consumption (live)' : 'Final consumption'}>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-ink-500">Duration</p>
                <p className="mt-0.5 text-2xl font-semibold tabular text-ink-900">
                  {fmtDuration(call.durationSeconds ?? call.elapsedSeconds)}
                </p>
              </div>
              <div className="border-t border-ink-100 pt-3">
                <p className="text-xs font-medium text-ink-500">Tokens consumed</p>
                <p className="mt-0.5 text-2xl font-semibold tabular text-ink-900">
                  {fmtTokens(call.tokensConsumedSoFar ?? call.tokensConsumed)}
                </p>
              </div>
              {call.remainingBalance != null && (
                <div className="border-t border-ink-100 pt-3">
                  <p className="text-xs font-medium text-ink-500">Caller balance now</p>
                  <p className="mt-0.5 text-lg font-semibold tabular text-ink-800">
                    {fmtTokens(call.remainingBalance)}
                  </p>
                </div>
              )}
            </div>
          </Card>

          <Card title="Caller">
            <p className="text-sm font-medium text-ink-900">
              {call.caller?.name || shortId(call.callerId)}
            </p>
            <Link
              to={`/users/${call.caller?.id}`}
              className="mt-1.5 block text-xs font-medium text-brand-600 hover:underline"
            >
              Open account
            </Link>
          </Card>

          <Card title="Listener">
            <p className="text-sm font-medium text-ink-900">
              {call.listener?.displayName || call.listener?.name || shortId(call.listenerId)}
            </p>
            <Link
              to={`/users/${call.listener?.id}`}
              className="mt-1.5 block text-xs font-medium text-brand-600 hover:underline"
            >
              Open account
            </Link>
          </Card>
        </div>

        {call.log && (
          <Card
            title="Immutable call log"
            description="Written once when the call reached a terminal state. This is what reporting reads."
            className="lg:col-span-3"
          >
            <DescList
              items={[
                { label: 'Duration', value: fmtDuration(call.log.durationSeconds) },
                { label: 'Tokens consumed', value: fmtTokens(call.log.tokensConsumed) },
                { label: 'Status', value: <StatusBadge status={call.log.status} /> },
                { label: 'Rate applied', value: `${call.log.ratePerSecond ?? call.ratePerSecond}/s` },
              ]}
            />
          </Card>
        )}

        {call.mediaMetadata && (
          <Card
            title="Media metadata"
            description="Phase 2 extension point — nullable JSON, unused for voice calls."
            className="lg:col-span-3"
          >
            <JsonBlock value={call.mediaMetadata} />
          </Card>
        )}
      </div>

      {terminateOpen && <TerminateModal call={call} onClose={() => setTerminateOpen(false)} />}
    </>
  );
}
