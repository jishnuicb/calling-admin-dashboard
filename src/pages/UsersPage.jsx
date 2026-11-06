import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Users } from 'lucide-react';
import { usersApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { useAuth } from '../auth/AuthContext';
import { P } from '../auth/permissions';
import { AdminMaskedName } from '../components/AdminMaskedName';
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
import { useApiMutation } from '../hooks/useApiMutation';
import { useTableState } from '../hooks/useTableState';
import { fmtDateTime, fmtNumber, fmtRelative, fmtTokens } from '../lib/format';

function RenameUserModal({ user, onClose }) {
  const [name, setName] = useState(user.originalName || user.name || '');
  const mutation = useApiMutation({
    mutationFn: () => usersApi.updateName(user.id, { name: name.trim() }),
    successMessage: 'User name updated',
    invalidate: [['users'], qk.user(user.id)],
    onSuccess: onClose,
  });
  const valid = name.trim().length >= 2 && name.trim().length <= 120;

  return (
    <Modal
      open
      onClose={onClose}
      title="Rename user"
      description="Updates the account display name. Uniqueness is enforced (same as the app)."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={mutation.isPending}
            disabled={!valid}
            onClick={() => mutation.mutate()}
          >
            Save name
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {mutation.error && <ErrorState error={mutation.error} compact />}
        <Field label="Name" required hint="2–120 characters">
          <Input
            value={name}
            maxLength={120}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            placeholder={user.originalName || user.name || ''}
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
 * @param {'all'|'pendingOtp'} [variant]
 */
export function UsersPage({ variant = 'all' }) {
  const navigate = useNavigate();
  const { hidesUserContact, can } = useAuth();
  const canRename = can(P.USERS_WRITE);
  const isPendingOtp = variant === 'pendingOtp';
  const [renameRow, setRenameRow] = useState(null);

  const table = useTableState({
    search: '',
    status: '',
    gender: '',
    country: '',
    isListener: '',
  });

  const listParams = {
    ...table.params,
    ...(isPendingOtp
      ? {
          mobileVerified: false,
          excludeDeleted: true,
          // Pending OTP page locks to non-deleted; ignore status "All"/DELETED.
          status:
            table.filters.status && table.filters.status !== 'DELETED'
              ? table.filters.status
              : undefined,
        }
      : {}),
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.users({ variant, ...listParams }),
    queryFn: () => usersApi.list(listParams),
  });

  const columns = [
    {
      key: 'user',
      header: 'User',
      render: (row) => (
        <div className="flex min-w-0 items-center gap-2.5">
          {row.profilePicture ? (
            <img
              src={row.profilePicture}
              alt=""
              className="size-8 shrink-0 rounded-full object-cover ring-1 ring-ink-200"
            />
          ) : (
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink-100 text-xs font-medium text-ink-500">
              {(row.name || '?').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <AdminMaskedName name={row.name} originalName={row.originalName} />
            {!hidesUserContact && (
              <p className="truncate text-xs text-ink-500 tabular">{row.mobile || '—'}</p>
            )}
            {!hidesUserContact && row.email ? (
              <p className="truncate text-xs text-ink-500">{row.email}</p>
            ) : null}
            {row.publicId && (
              <p className="truncate font-mono text-[11px] text-ink-500">{row.publicId}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'gender',
      header: 'Gender',
      render: (row) => {
        const gender = row.gender || 'UNDISCLOSED';

        return (
          <Badge
            tone={
              gender === 'FEMALE' ? 'success' : gender === 'MALE' ? 'info' : 'neutral'
            }
          >
            {gender.charAt(0) + gender.slice(1).toLowerCase()}
          </Badge>
        );
      },
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'listener',
      header: 'Listener',
      render: (row) =>
        row.listenerStatus ? (
          <div className="flex items-center gap-1.5">
            <StatusBadge status={row.listenerStatus} />
            {row.listenerOnline && (
              <Badge tone="success" dot>
                online
              </Badge>
            )}
          </div>
        ) : (
          <span className="text-xs text-ink-400">Caller only</span>
        ),
    },
    {
      key: 'balance',
      header: 'Balance',
      align: 'right',
      render: (row) => (
        <span className="font-medium text-ink-800">{fmtTokens(row.walletBalance ?? 0)}</span>
      ),
    },
    {
      key: 'calls',
      header: 'Calls',
      align: 'right',
      render: (row) => (
        <span className="text-xs text-ink-600" title="As caller / as listener">
          {fmtNumber(row.callsAsCaller ?? 0)} / {fmtNumber(row.callsAsListener ?? 0)}
        </span>
      ),
    },
    {
      key: 'reportsAgainst',
      header: 'Reports',
      align: 'right',
      render: (row) =>
        row.reportsAgainst > 0 ? (
          <Badge tone="danger">{row.reportsAgainst}</Badge>
        ) : (
          <span className="text-xs text-ink-400">0</span>
        ),
    },
    {
      key: 'country',
      header: 'Country',
      render: (row) => row.country || <span className="text-ink-400">—</span>,
    },
    {
      key: 'verified',
      header: 'OTP verified',
      render: (row) =>
        row.mobileVerified ? (
          <Badge tone="success">Yes</Badge>
        ) : (
          <Badge tone="warning">Pending</Badge>
        ),
    },
    {
      key: 'lastLoginMethod',
      header: 'Login via',
      render: (row) => {
        const method = row.lastLoginMethod;
        if (!method) return <span className="text-xs text-ink-400">—</span>;
        if (method === 'MSG91_WHATSAPP') {
          return <Badge tone="info">WhatsApp</Badge>;
        }
        if (method === 'BACKUP_OTP') {
          return <Badge tone="warning">Backup OTP</Badge>;
        }
        if (method === 'MSG91') {
          return <Badge tone="info">MSG91</Badge>;
        }
        if (method === 'GOOGLE') {
          return <Badge tone="info">Google</Badge>;
        }
        if (method === 'APPLE') {
          return <Badge tone="info">Apple</Badge>;
        }
        return <Badge tone="neutral">{method}</Badge>;
      },
    },
    {
      key: 'createdAt',
      header: 'Registered',
      render: (row) => (
        <span className="text-xs text-ink-600" title={fmtDateTime(row.createdAt)}>
          {fmtRelative(row.createdAt)}
        </span>
      ),
    },
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
                title="Change user name"
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
      <PageHeader
        title={isPendingOtp ? 'Pending users' : 'Users'}
        description={
          isPendingOtp
            ? 'Registered accounts that have not completed OTP verification yet. Deleted accounts are excluded.'
            : 'Every account on the platform. Each user is a caller by default; the listener column shows whether they also hold an application.'
        }
      />

      <Card bodyClassName="">
        <FilterBar onReset={table.isFiltered ? table.reset : undefined}>
          <Field label="Search" className="w-full sm:w-64">
            <SearchInput
              value={table.filters.search}
              onChange={(v) => table.setFilter('search', v)}
              placeholder="Name, phone, email, public id or user id"
            />
          </Field>

          <Field label="Account status" className="w-40">
            <Select
              value={table.filters.status}
              onChange={(e) => table.setFilter('status', e.target.value)}
            >
              <option value="">All</option>
              <option value="ACTIVE">Active</option>
              <option value="BLOCKED">Blocked</option>
              {!isPendingOtp && <option value="DELETED">Deleted</option>}
            </Select>
          </Field>

          {!isPendingOtp && (
            <Field label="Is listener" className="w-36">
              <Select
                value={table.filters.isListener}
                onChange={(e) => table.setFilter('isListener', e.target.value)}
              >
                <option value="">All</option>
                <option value="true">Listeners</option>
                <option value="false">Callers only</option>
              </Select>
            </Field>
          )}

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

          <Field label="Country" className="w-40">
            <SearchInput
              value={table.filters.country}
              onChange={(v) => table.setFilter('country', v)}
              placeholder="e.g. Oman, Qatar"
            />
          </Field>
        </FilterBar>

        <DataTable
          columns={columns}
          rows={data?.data}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          onRowClick={(row) =>
            navigate(`/users/${row.id}`, {
              state: {
                from: isPendingOtp ? '/pending-users' : '/users',
              },
            })
          }
          emptyIcon={Users}
          emptyTitle={
            isPendingOtp
              ? 'No users awaiting OTP verification'
              : 'No users match these filters'
          }
          emptyDescription={
            isPendingOtp
              ? 'Users appear here after register and leave once OTP verify succeeds.'
              : 'Try widening the search or clearing the filters.'
          }
        />

        <Pagination
          meta={data?.meta}
          onPageChange={table.setPage}
          onLimitChange={table.changeLimit}
        />
      </Card>

      {renameRow && (
        <RenameUserModal user={renameRow} onClose={() => setRenameRow(null)} />
      )}
    </>
  );
}

export function PendingUsersPage() {
  return <UsersPage variant="pendingOtp" />;
}
