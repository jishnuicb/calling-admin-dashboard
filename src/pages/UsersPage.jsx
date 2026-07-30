import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { usersApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { DataTable, FilterBar, Pagination } from '../components/DataTable';
import { Badge, Card, Field, PageHeader, SearchInput, Select, StatusBadge } from '../components/ui';
import { useTableState } from '../hooks/useTableState';
import { fmtDateTime, fmtNumber, fmtRelative, fmtTokens } from '../lib/format';

export function UsersPage() {
  const navigate = useNavigate();
  const table = useTableState({
    search: '',
    status: '',
    gender: '',
    country: '',
    isListener: '',
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.users(table.params),
    queryFn: () => usersApi.list(table.params),
  });

  const columns = [
    {
      key: 'user',
      header: 'User',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink-900">{row.name || 'Unnamed'}</p>
          <p className="truncate text-xs text-ink-500 tabular">{row.mobile || '—'}</p>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'listener',
      header: 'Listener',
      render: (row) =>
        row.listenerStatus ? (
          <div className="flex items-center gap-1.5">
            <StatusBadge status={row.listenerStatus} />
            {row.listenerOnline && <Badge tone="success" dot>online</Badge>}
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
      header: 'Verified',
      render: (row) =>
        row.mobileVerified ? (
          <Badge tone="success">Yes</Badge>
        ) : (
          <Badge tone="warning">Pending</Badge>
        ),
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
        title="Users"
        description="Every account on the platform. Each user is a caller by default; the listener column shows whether they also hold an application."
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
              <option value="DELETED">Deleted</option>
            </Select>
          </Field>

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
          emptyTitle="No users match these filters"
          emptyDescription="Try widening the search or clearing the filters."
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
