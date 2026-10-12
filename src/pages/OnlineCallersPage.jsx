import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Radio } from 'lucide-react';
import { usersApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { DataTable } from '../components/DataTable';
import { Badge, Button, Card, ErrorState, PageHeader, StatusBadge } from '../components/ui';
import { fmtRelative, titleCase } from '../lib/format';

export function OnlineCallersPage() {
  const navigate = useNavigate();

  const { data, isLoading, error, refetch, dataUpdatedAt, isFetching } = useQuery({
    queryKey: qk.onlineCallers,
    queryFn: () => usersApi.onlineCallers(),
    refetchInterval: 15_000,
  });

  const rows = data?.data || [];
  const total = data?.total ?? rows.length;

  const columns = [
    {
      key: 'user',
      header: 'Caller',
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
            tone={gender === 'FEMALE' ? 'success' : gender === 'MALE' ? 'info' : 'neutral'}
          >
            {titleCase(gender)}
          </Badge>
        );
      },
    },
    {
      key: 'country',
      header: 'Country',
      render: (row) => row.country || <span className="text-ink-400">—</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'sockets',
      header: 'Devices',
      align: 'right',
      render: (row) => (
        <span className="tabular text-ink-700">{row.socketCount ?? 1}</span>
      ),
    },
    {
      key: 'lastLoginAt',
      header: 'Last login',
      render: (row) =>
        row.lastLoginAt ? (
          <span className="text-xs text-ink-600" title={row.lastLoginAt}>
            {fmtRelative(row.lastLoginAt)}
          </span>
        ) : (
          <span className="text-xs text-ink-400">—</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Online callers"
        description="Live callers currently connected to the app (excludes listeners who are listed online)."
        actions={
          <div className="flex items-center gap-2">
            <Badge tone="success" dot>
              {total} online
            </Badge>
            <Button
              size="sm"
              variant="secondary"
              loading={isFetching}
              onClick={() => refetch()}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {error && <ErrorState error={error} onRetry={refetch} />}

      {data?.socketAvailable === false && (
        <p className="mb-3 text-sm text-amber-700">
          Socket server is not available on this process — count may be empty until realtime is up.
        </p>
      )}

      <Card className="overflow-hidden p-0">
        <DataTable
          columns={columns}
          rows={rows}
          loading={isLoading}
          emptyIcon={Radio}
          emptyTitle="No callers online right now"
          emptyDescription="Connected callers in the discovery room will appear here."
          onRowClick={(row) => navigate(`/users/${row.id}`)}
        />
      </Card>

      {dataUpdatedAt ? (
        <p className="mt-2 text-xs text-ink-400">
          Updated {fmtRelative(new Date(dataUpdatedAt).toISOString())} · auto-refreshes every 15s
        </p>
      ) : null}
    </>
  );
}
