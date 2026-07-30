import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Check, PauseCircle, PlayCircle, StickyNote, X } from 'lucide-react';
import { listenersApi } from '../api/endpoints';
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
  StatusBadge,
  Textarea,
} from '../components/ui';
import { fmtDate, fmtDateTime, fmtRelative, titleCase } from '../lib/format';

/**
 * The four review decisions share one modal. `reason` is required for reject and
 * suspend (the API enforces it) and optional elsewhere, which is why the config
 * below drives both the copy and the validation.
 */
const DECISIONS = {
  approve: {
    title: 'Approve this application',
    description:
      'The listener becomes discoverable once they go online. Approval does not force them online.',
    confirmLabel: 'Approve',
    variant: 'primary',
    reasonRequired: false,
    notesField: 'verificationNotes',
    notesLabel: 'Verification notes',
    notesPlaceholder: 'ID verified, profile photo acceptable.',
  },
  reject: {
    title: 'Reject this application',
    description:
      'The applicant stays a fully working caller and may re-apply after fixing the issue.',
    confirmLabel: 'Reject',
    variant: 'danger',
    reasonRequired: true,
    reasonLabel: 'Rejection reason',
    reasonPlaceholder: 'Profile photo does not meet guidelines',
    notesField: 'verificationNotes',
    notesLabel: 'Internal notes',
  },
  suspend: {
    title: 'Suspend this listener',
    description:
      'Live sockets are dropped immediately so they stop receiving calls. They remain able to make calls as a caller.',
    confirmLabel: 'Suspend',
    variant: 'danger',
    reasonRequired: true,
    reasonLabel: 'Suspension reason',
    reasonPlaceholder: 'Multiple substantiated abuse reports',
  },
  reactivate: {
    title: 'Reactivate this listener',
    description: 'The listener returns to APPROVED and can go online again when they choose.',
    confirmLabel: 'Reactivate',
    variant: 'primary',
    reasonRequired: false,
    notesField: 'verificationNotes',
    notesLabel: 'Verification notes',
  },
};

function ReviewModal({ decision, application, onClose }) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const config = decision ? DECISIONS[decision] : null;

  const mutation = useApiMutation({
    mutationFn: () => {
      const body = {};
      if (config.reasonRequired || reason) body.reason = reason;
      if (config.notesField && notes) body[config.notesField] = notes;
      return listenersApi[decision](application.id, body);
    },
    successMessage: `Application ${decision}d`,
    invalidate: [['listeners'], ['users'], ['dashboard']],
    onSuccess: () => {
      setReason('');
      setNotes('');
      onClose();
    },
  });

  if (!config) return null;

  const canSubmit = !config.reasonRequired || reason.trim().length > 0;

  return (
    <Modal
      open
      onClose={onClose}
      title={config.title}
      description={config.description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={config.variant}
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!canSubmit}
          >
            {config.confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {mutation.error && <ErrorState error={mutation.error} compact />}

        {(config.reasonRequired || config.reasonLabel) && (
          <Field
            label={config.reasonLabel || 'Reason'}
            required={config.reasonRequired}
            hint={config.reasonRequired ? 'Shown to the applicant in their notification.' : undefined}
          >
            <Textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={config.reasonPlaceholder}
            />
          </Field>
        )}

        {config.notesField && (
          <Field label={config.notesLabel} hint="Internal only — not shown to the applicant.">
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={config.notesPlaceholder}
            />
          </Field>
        )}

        {decision === 'approve' && !application.languages?.length && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            This applicant has no languages selected, so approval will be refused. A listener with
            no languages would be invisible to every discovery filter — ask them to re-apply.
          </p>
        )}
      </div>
    </Modal>
  );
}

function NotesModal({ application, onClose }) {
  const [notes, setNotes] = useState('');

  const mutation = useApiMutation({
    mutationFn: () => listenersApi.addNotes(application.id, { notes }),
    successMessage: 'Notes saved',
    invalidate: [['listeners']],
    onSuccess: () => {
      setNotes('');
      onClose();
    },
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Add verification notes"
      description="Internal record attached to the application. Does not change its status."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!notes.trim()}
          >
            Save notes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {mutation.error && <ErrorState error={mutation.error} compact />}
        <Field label="Notes" required>
          <Textarea
            rows={5}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Follow-up call scheduled with the applicant."
          />
        </Field>
      </div>
    </Modal>
  );
}

export function ListenerDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const [decision, setDecision] = useState(null);
  const [notesOpen, setNotesOpen] = useState(false);

  const { data: application, isLoading, error, refetch } = useQuery({
    queryKey: qk.listener(id),
    queryFn: () => listenersApi.get(id),
  });

  const syncBeneficiary = useApiMutation({
    mutationFn: () => listenersApi.syncBeneficiary(id),
    successMessage: 'Cashfree beneficiary synced',
    invalidate: [qk.listener(id), ['listeners']],
  });

  if (isLoading) return <LoadingBlock label="Loading application…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const { status } = application;

  // Mirrors the backend's allowed transitions, so the UI cannot offer an action
  // that would come back as INVALID_STATUS_TRANSITION.
  const canApprove = status === 'PENDING' && can(P.LISTENERS_APPROVE);
  const canReject = status === 'PENDING' && can(P.LISTENERS_APPROVE);
  const canSuspend = status === 'APPROVED' && can(P.LISTENERS_SUSPEND);
  const canReactivate = status === 'SUSPENDED' && can(P.LISTENERS_SUSPEND);

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link
            to="/listeners"
            className="mb-1.5 inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-700"
          >
            <ArrowLeft className="size-3.5" />
            Back to applications
          </Link>
        }
        title={application.displayName || 'Listener application'}
        description={`${titleCase(application.gender)} · ${application.country || 'Unknown country'}`}
        actions={
          <>
            {can(P.LISTENERS_APPROVE) && (
              <Button variant="secondary" onClick={() => setNotesOpen(true)}>
                <StickyNote className="size-4" />
                Add notes
              </Button>
            )}
            {canReject && (
              <Button variant="secondary" onClick={() => setDecision('reject')}>
                <X className="size-4" />
                Reject
              </Button>
            )}
            {canApprove && (
              <Button onClick={() => setDecision('approve')}>
                <Check className="size-4" />
                Approve
              </Button>
            )}
            {canSuspend && (
              <Button variant="danger" onClick={() => setDecision('suspend')}>
                <PauseCircle className="size-4" />
                Suspend
              </Button>
            )}
            {canReactivate && (
              <Button onClick={() => setDecision('reactivate')}>
                <PlayCircle className="size-4" />
                Reactivate
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Application" className="lg:col-span-2">
          <DescList
            items={[
              { label: 'Status', value: <StatusBadge status={status} /> },
              {
                label: 'Availability',
                value:
                  status === 'APPROVED' ? (
                    application.online ? (
                      <Badge tone="success" dot>
                        Online
                      </Badge>
                    ) : (
                      <span>
                        Offline
                        {application.availabilityEnabled ? (
                          // Intent is on but no live socket: a dropped
                          // connection, so they return without any action.
                          <span className="ml-1.5 text-xs text-amber-700">
                            (go-online enabled, currently disconnected)
                          </span>
                        ) : (
                          <span className="ml-1.5 text-xs text-ink-500">
                            (not taking calls — only they can go online)
                          </span>
                        )}
                      </span>
                    )
                  ) : (
                    '—'
                  ),
              },
              {
                label: 'Age',
                value:
                  application.age != null ? (
                    `${application.age} years`
                  ) : (
                    <span className="text-amber-700">
                      No date of birth on file — must re-apply before approval
                    </span>
                  ),
              },
              { label: 'Date of birth', value: fmtDate(application.dateOfBirth) },
              { label: 'Application id', value: application.id, mono: true },
              { label: 'User id', value: application.userId, mono: true },
              { label: 'Submitted', value: fmtDateTime(application.submittedAt) },
              { label: 'Last seen', value: application.lastSeenAt ? fmtRelative(application.lastSeenAt) : '—' },
              { label: 'Reviewed', value: fmtDateTime(application.reviewedAt) },
              { label: 'Re-applications', value: application.reapplyCount ?? 0 },
              { label: 'Bio', value: application.bio, full: true },
              {
                label: 'Interests',
                value: application.interests?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {application.interests.map((i) => (
                      <Badge key={i}>{i}</Badge>
                    ))}
                  </div>
                ) : null,
                full: true,
              },
              application.rejectionReason && {
                label: 'Rejection reason',
                value: <span className="text-red-700">{application.rejectionReason}</span>,
                full: true,
              },
              application.suspensionReason && {
                label: 'Suspension reason',
                value: <span className="text-red-700">{application.suspensionReason}</span>,
                full: true,
              },
              application.verificationNotes && {
                label: 'Verification notes',
                value: <span className="whitespace-pre-wrap">{application.verificationNotes}</span>,
                full: true,
              },
            ]}
          />
        </Card>

        <div className="space-y-4">
          <Card
            title="Languages"
            description="At least one is mandatory. Deactivated languages remain listed here."
          >
            {application.languages?.length ? (
              <div className="flex flex-wrap gap-2">
                {application.languages.map((l) => (
                  <Badge key={l.id || l.name} tone={l.active === false ? 'neutral' : 'brand'}>
                    {l.name}
                    {l.active === false && ' (inactive)'}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-amber-700">
                No languages selected. Approval will be refused until the applicant re-applies with
                at least one.
              </p>
            )}
          </Card>

          {application.userId && (
            <Card title="Account">
              <Link
                to={`/users/${application.userId}`}
                className="text-sm font-medium text-brand-600 hover:underline"
              >
                Open user account
              </Link>
              <p className="mt-2 text-xs text-ink-500">
                Listener status never affects caller ability — this account can make calls whatever
                the application says.
              </p>
            </Card>
          )}
        </div>

        <Card
          title="Payout details"
          description="Bank details for Cashfree Payouts. Approving creates a beneficiary automatically (retry below if it failed)."
          className="lg:col-span-2"
        >
          {application.bankDetails?.provided ? (
            <>
              <DescList
                items={[
                  { label: 'Account holder', value: application.bankDetails.accountHolderName },
                  { label: 'Bank', value: application.bankDetails.bankName },
                  {
                    // The application detail response is the only place the full
                    // number is returned; every list shows it masked.
                    label: 'Account number',
                    value: application.bankDetails.bankAccountNumber,
                    mono: true,
                  },
                  { label: 'IFSC', value: application.bankDetails.ifscCode, mono: true },
                  {
                    label: 'UPI id',
                    value: application.bankDetails.upiId,
                    mono: true,
                  },
                  {
                    label: 'Cashfree beneficiary',
                    value: application.beneficiaryStatus || 'NONE',
                  },
                  {
                    label: 'Beneficiary id',
                    value: application.cashfreeBeneId || '—',
                    mono: true,
                  },
                ]}
              />
              {application.beneficiaryError && (
                <p className="mt-2 text-xs text-amber-700">{application.beneficiaryError}</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <p className="text-xs text-ink-500">
                  The listener can correct bank details from the app without re-applying.
                </p>
                {can(P.PAYOUTS_WRITE) && (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={syncBeneficiary.isPending}
                    onClick={() => syncBeneficiary.mutate()}
                  >
                    Sync Cashfree beneficiary
                  </Button>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
              <p className="font-medium">No usable payout details on file.</p>
              <p className="mt-1 text-xs">
                {application.bankDetails?.bankAccountNumberMasked
                  ? 'Some fields are present but the set is incomplete, so a payout would fail.'
                  : 'This application was submitted before payout details were collected.'}{' '}
                Account holder name, account number, IFSC, bank name and UPI id are all required. Ask
                the listener to complete them, otherwise their earnings cannot be paid out.
              </p>
            </div>
          )}
        </Card>
      </div>

      {decision && (
        <ReviewModal
          decision={decision}
          application={application}
          onClose={() => setDecision(null)}
        />
      )}
      {notesOpen && <NotesModal application={application} onClose={() => setNotesOpen(false)} />}
    </>
  );
}
