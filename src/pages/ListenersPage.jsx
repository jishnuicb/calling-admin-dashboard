import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, Mic, Pencil, UserCheck, UserRoundSearch } from 'lucide-react';
import { languagesApi, listenersApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { DataTable, FilterBar, Pagination } from '../components/DataTable';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  StatusBadge,
} from '../components/ui';
import { useTableState } from '../hooks/useTableState';
import { useApiMutation } from '../hooks/useApiMutation';
import { useAuth } from '../auth/AuthContext';
import { P } from '../auth/permissions';
import { fmtRelative, titleCase } from '../lib/format';

const PAGE_VARIANTS = {
  applications: {
    title: 'Listener applications',
    description:
      'Pending, rejected, and suspended applications. Approved listeners are under Active listeners.',
    emptyTitle: 'No applications match these filters',
    emptyIcon: BadgeCheck,
    // Locked set when status filter is empty ("All" within this page).
    defaultStatuses: ['PENDING', 'REJECTED', 'SUSPENDED'],
    statusOptions: [
      { value: '', label: 'All (pending / rejected / suspended)' },
      { value: 'PENDING', label: 'Pending' },
      { value: 'REJECTED', label: 'Rejected' },
      { value: 'SUSPENDED', label: 'Suspended' },
    ],
    excludeDeleted: true,
    showAvailability: false,
  },
  active: {
    title: 'Active listeners',
    description: 'Approved listeners only. Manage presence, payouts, and profile from the detail page.',
    emptyTitle: 'No active listeners match these filters',
    emptyIcon: UserCheck,
    defaultStatuses: ['APPROVED'],
    statusOptions: null,
    excludeDeleted: true,
    showAvailability: true,
  },
  pending: {
    title: 'Pending users',
    description:
      'Listener applications awaiting verification. Deleted accounts are excluded.',
    emptyTitle: 'No pending applications',
    emptyIcon: UserRoundSearch,
    defaultStatuses: ['PENDING'],
    statusOptions: null,
    excludeDeleted: true,
    showAvailability: false,
  },
};

function RenameListenerModal({ application, onClose }) {
  const [displayName, setDisplayName] = useState(application.displayName || '');

  const mutation = useApiMutation({
    mutationFn: () =>
      listenersApi.updateDisplayName(application.id, {
        displayName: displayName.trim(),
      }),
    successMessage: 'Listener name updated',
    invalidate: [['listeners']],
    onSuccess: onClose,
  });

  const valid = displayName.trim().length >= 2 && displayName.trim().length <= 120;

  return (
    <Modal
      open
      onClose={onClose}
      title="Change listener name"
      description="Updates the public listener display name only. Does not change account login name or status."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {mutation.error && <ErrorState error={mutation.error} compact />}
        <Field label="Display name" hint="2–120 characters">
          <Input
            value={displayName}
            maxLength={120}
            autoFocus
            onChange={(e) => setDisplayName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && valid && !mutation.isPending) mutation.mutate();
            }}
          />
        </Field>
      </div>
    </Modal>
  );
}

/**
 * @param {'applications'|'active'|'pending'} [variant]
 */
export function ListenersPage({ variant = 'applications' }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { can } = useAuth();
  const canRename = can(P.LISTENERS_APPROVE);
  const [renameRow, setRenameRow] = useState(null);
  const config = PAGE_VARIANTS[variant] || PAGE_VARIANTS.applications;

  const allowedStatusValues = new Set(
    (config.statusOptions || []).map((o) => o.value).filter(Boolean),
  );
  const urlStatus = searchParams.get('status') || '';
  const initialStatus =
    config.statusOptions && allowedStatusValues.has(urlStatus) ? urlStatus : '';

  const table = useTableState({
    status: initialStatus,
    search: '',
    country: '',
    gender: '',
    languages: '',
    availabilityEnabled: '',
  });

  const listParams = {
    ...table.params,
    excludeDeleted: config.excludeDeleted ? true : undefined,
  };

  if (table.filters.status) {
    listParams.status = table.filters.status;
    delete listParams.statuses;
  } else if (config.defaultStatuses?.length === 1) {
    listParams.status = config.defaultStatuses[0];
    delete listParams.statuses;
  } else if (config.defaultStatuses?.length) {
    listParams.statuses = config.defaultStatuses.join(',');
    delete listParams.status;
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.listeners({ variant, ...listParams }),
    queryFn: () => listenersApi.list(listParams),
  });

  const { data: languages } = useQuery({
    queryKey: qk.languages({ active: true }),
    queryFn: () => languagesApi.list({ active: true }),
  });

  const columns = [
    {
      key: 'listener',
      header: 'Listener',
      render: (row) => (
        <div className="flex min-w-0 items-center gap-2.5">
          {row.photoUrl ? (
            <img
              src={row.photoUrl}
              alt=""
              className="size-8 shrink-0 rounded-full object-cover ring-1 ring-ink-200"
            />
          ) : (
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink-100 text-xs font-medium text-ink-500">
              {(row.displayName || '?').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-medium text-ink-900">{row.displayName || 'Unnamed'}</p>
            <p className="truncate text-xs text-ink-500">{row.user?.name || row.userId}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={row.status} />
          {row.isReopened && <Badge tone="warning">Reopened</Badge>}
        </div>
      ),
    },
    {
      key: 'gender',
      header: 'Gender',
      render: (row) => titleCase(row.gender) || '—',
    },
    {
      key: 'languages',
      header: 'Languages',
      render: (row) =>
        row.languages?.length ? (
          <span className="text-xs text-ink-700">
            {row.languages.map((l) => l.name).join(', ')}
          </span>
        ) : (
          <span className="text-xs text-ink-400">—</span>
        ),
    },
    {
      key: 'country',
      header: 'Country',
      render: (row) => row.country || <span className="text-ink-400">—</span>,
    },
    {
      key: 'voice',
      header: 'Voice',
      render: (row) =>
        row.voiceNoteUrl ? (
          <Mic className="size-4 text-brand-600" title="Has voice note" />
        ) : (
          <span className="text-xs text-ink-400">—</span>
        ),
    },
    {
      key: 'submittedAt',
      header: 'Submitted',
      render: (row) => (
        <span className="text-xs text-ink-600" title={row.submittedAt}>
          {fmtRelative(row.submittedAt)}
        </span>
      ),
    },
    ...(config.showAvailability
      ? [
          {
            key: 'online',
            header: 'Online',
            render: (row) =>
              row.online ? (
                <Badge tone="success" dot>
                  online
                </Badge>
              ) : (
                <span className="text-xs text-ink-400">offline</span>
              ),
          },
        ]
      : []),
    ...(canRename
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right',
            render: (row) => (
              <Button
                size="sm"
                variant="secondary"
                title="Change listener name"
                onClick={(e) => {
                  e.stopPropagation();
                  setRenameRow(row);
                }}
              >
                <Pencil className="size-3.5" />
                Rename
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader title={config.title} description={config.description} />

      <Card bodyClassName="">
        <FilterBar onReset={table.isFiltered ? table.reset : undefined}>
          <Field label="Search" className="w-full sm:w-56">
            <SearchInput
              value={table.filters.search}
              onChange={(v) => table.setFilter('search', v)}
              placeholder="Display name or user id"
            />
          </Field>

          {config.statusOptions && (
            <Field label="Status" className="w-56">
              <Select
                value={table.filters.status}
                onChange={(e) => table.setFilter('status', e.target.value)}
              >
                {config.statusOptions.map((opt) => (
                  <option key={opt.value || 'all'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field label="Language" className="w-40">
            <Select
              value={table.filters.languages}
              onChange={(e) => table.setFilter('languages', e.target.value)}
            >
              <option value="">All</option>
              {(languages?.data || []).map((l) => (
                <option key={l.id} value={l.name}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Gender" className="w-36">
            <Select
              value={table.filters.gender}
              onChange={(e) => table.setFilter('gender', e.target.value)}
            >
              <option value="">All</option>
              <option value="FEMALE">Female</option>
              <option value="MALE">Male</option>
              <option value="OTHER">Other</option>
              <option value="UNDISCLOSED">Undisclosed</option>
            </Select>
          </Field>

          {config.showAvailability && (
            <Field label="Availability" className="w-44">
              <Select
                value={table.filters.availabilityEnabled}
                onChange={(e) => table.setFilter('availabilityEnabled', e.target.value)}
              >
                <option value="">Any</option>
                <option value="true">Go-online enabled</option>
                <option value="false">Not taking calls</option>
              </Select>
            </Field>
          )}

          <Field label="Country" className="w-36">
            <SearchInput
              value={table.filters.country}
              onChange={(v) => table.setFilter('country', v)}
              placeholder="India"
            />
          </Field>
        </FilterBar>

        <DataTable
          columns={columns}
          rows={data?.data}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          onRowClick={(row) => navigate(`/listeners/${row.id}`)}
          emptyIcon={config.emptyIcon}
          emptyTitle={config.emptyTitle}
        />

        <Pagination
          meta={data?.meta}
          onPageChange={table.setPage}
          onLimitChange={table.changeLimit}
        />
      </Card>

      {renameRow && (
        <RenameListenerModal application={renameRow} onClose={() => setRenameRow(null)} />
      )}
    </>
  );
}

export function ActiveListenersPage() {
  return <ListenersPage variant="active" />;
}

export function PendingUsersPage() {
  return <ListenersPage variant="pending" />;
}
