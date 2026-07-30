import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Gavel } from 'lucide-react';
import { moderationApi } from '../api/endpoints';
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
  LoadingBlock,
  Modal,
  PageHeader,
  Select,
  StatusBadge,
  Textarea,
} from '../components/ui';
import { fmtDateTime, shortId, titleCase } from '../lib/format';

const ACTIONS = [
  { value: 'NONE', label: 'No action', hint: 'Logged, but nothing is enforced.' },
  { value: 'WARNING_ISSUED', label: 'Issue a warning', hint: 'Notifies the reported user.' },
  {
    value: 'LISTENER_SUSPENDED',
    label: 'Suspend the listener',
    hint: 'Drops their sockets and removes them from discovery. They remain a caller.',
  },
  {
    value: 'USER_BLOCKED',
    label: 'Block the user account',
    hint: 'Revokes all sessions. The account cannot call or be called.',
  },
  { value: 'CONTENT_REMOVED', label: 'Content removed', hint: 'Recorded for the audit trail.' },
];

function ReviewModal({ report, onClose }) {
  const [form, setForm] = useState({
    status: report.status === 'PENDING' ? 'UNDER_REVIEW' : 'RESOLVED',
    actionTaken: 'NONE',
    investigationNotes: '',
  });

  const mutation = useApiMutation({
    mutationFn: () =>
      moderationApi.review(report.id, {
        status: form.status,
        actionTaken: form.actionTaken,
        investigationNotes: form.investigationNotes || undefined,
      }),
    successMessage: 'Report updated',
    invalidate: [['moderation'], ['users'], ['listeners'], ['dashboard']],
    onSuccess: onClose,
  });

  const selectedAction = ACTIONS.find((a) => a.value === form.actionTaken);
  const enforcing = ['LISTENER_SUSPENDED', 'USER_BLOCKED'].includes(form.actionTaken);

  return (
    <Modal
      open
      onClose={onClose}
      title="Review this report"
      description="Moving to a terminal status applies the chosen enforcement action."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={enforcing ? 'danger' : 'primary'}
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
          >
            Save review
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {mutation.error && <ErrorState error={mutation.error} compact />}

        <Field label="New status" required>
          <Select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            <option value="UNDER_REVIEW">Under review — investigating</option>
            <option value="RESOLVED">Resolved — complaint substantiated or handled</option>
            <option value="REJECTED">Rejected — not substantiated</option>
          </Select>
        </Field>

        <Field label="Enforcement action" hint={selectedAction?.hint}>
          <Select
            value={form.actionTaken}
            onChange={(e) => setForm({ ...form, actionTaken: e.target.value })}
          >
            {ACTIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Investigation notes" hint="Internal record, stored on the report.">
          <Textarea
            rows={4}
            value={form.investigationNotes}
            onChange={(e) => setForm({ ...form, investigationNotes: e.target.value })}
            placeholder="Reviewed the call log and prior reports; complaint substantiated."
          />
        </Field>

        {enforcing && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            This takes effect immediately and is recorded in the audit log with your admin id.
          </p>
        )}
      </div>
    </Modal>
  );
}

export function ModerationDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const [reviewOpen, setReviewOpen] = useState(false);

  const { data: report, isLoading, error, refetch } = useQuery({
    queryKey: qk.report(id),
    queryFn: () => moderationApi.get(id),
  });

  if (isLoading) return <LoadingBlock label="Loading report…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const isOpen = ['PENDING', 'UNDER_REVIEW'].includes(report.status);

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link
            to="/moderation"
            className="mb-1.5 inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-700"
          >
            <ArrowLeft className="size-3.5" />
            Back to moderation
          </Link>
        }
        title={titleCase(report.reason)}
        description={`Reported ${fmtDateTime(report.createdAt)}`}
        actions={
          isOpen &&
          can(P.MODERATION_REVIEW) && (
            <Button onClick={() => setReviewOpen(true)}>
              <Gavel className="size-4" />
              Review
            </Button>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Report" className="lg:col-span-2">
          <DescList
            items={[
              { label: 'Status', value: <StatusBadge status={report.status} /> },
              {
                label: 'Action taken',
                value:
                  report.actionTaken && report.actionTaken !== 'NONE' ? (
                    <Badge tone="info">{titleCase(report.actionTaken)}</Badge>
                  ) : null,
              },
              { label: 'Report id', value: report.id, mono: true },
              { label: 'Reason', value: titleCase(report.reason) },
              { label: 'Reported at', value: fmtDateTime(report.createdAt) },
              { label: 'Reviewed at', value: fmtDateTime(report.reviewedAt) },
              {
                label: 'Description from the reporter',
                value: report.description ? (
                  <span className="whitespace-pre-wrap">{report.description}</span>
                ) : null,
                full: true,
              },
              {
                label: 'Investigation notes',
                value: report.investigationNotes ? (
                  <span className="whitespace-pre-wrap">{report.investigationNotes}</span>
                ) : null,
                full: true,
              },
            ]}
          />
        </Card>

        <div className="space-y-4">
          <Card title="Reported user">
            <p className="text-sm font-medium text-ink-900">
              {report.reportedUser?.name || shortId(report.reportedUserId)}
            </p>
            {report.reportedUser?.status && (
              <div className="mt-1.5">
                <StatusBadge status={report.reportedUser.status} />
              </div>
            )}
            <Link
              to={`/users/${report.reportedUserId}`}
              className="mt-2 block text-xs font-medium text-brand-600 hover:underline"
            >
              Open account
            </Link>
          </Card>

          <Card title="Reporter">
            <p className="text-sm text-ink-800">
              {report.reporter?.name || shortId(report.reporterId)}
            </p>
            <Link
              to={`/users/${report.reporterId}`}
              className="mt-1.5 block text-xs font-medium text-brand-600 hover:underline"
            >
              Open account
            </Link>
          </Card>

          {report.callSessionId && (
            <Card title="Referenced call">
              <p className="font-mono text-xs text-ink-600">{report.callSessionId}</p>
              <Link
                to={`/calls/${report.callSessionId}`}
                className="mt-1.5 block text-xs font-medium text-brand-600 hover:underline"
              >
                Open call session
              </Link>
            </Card>
          )}
        </div>
      </div>

      {reviewOpen && <ReviewModal report={report} onClose={() => setReviewOpen(false)} />}
    </>
  );
}
