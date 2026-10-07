import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { usersApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { DataTable, FilterBar, Pagination } from '../components/DataTable';
import { Badge, Card, Field, PageHeader, SearchInput, Select, StatusBadge } from '../components/ui';
import { useTableState } from '../hooks/useTableState';
import { fmtDateTime, fmtNumber, fmtRelative, fmtTokens } from '../lib/format';

/**
 * @param {'all'|'pendingOtp'} [variant]
 */
export function UsersPage({ variant = 'all' }) {
  const navigate = useNavigate();
  const isPendingOtp = variant === 'pendingOtp';

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
            <p className="truncate font-medium text-ink-900">{row.name || 'Unnamed'}</p>
            <p className="truncate text-xs text-ink-500 tabular">{row.mobile || '—'}</p>
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
        if (method === 'BACKUP_OTP') {
          return <Badge tone="warning">Backup OTP</Badge>;
        }
        if (method === 'MSG91') {
          return <Badge tone="info">MSG91</Badge>;
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
              placeholder="Name, phone or user id"
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
          onRowClick={(row) => navigate(`/users/${row.id}`)}
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
    </>
  );
}

export function PendingUsersPage() {
  return <UsersPage variant="pendingOtp" />;
}
