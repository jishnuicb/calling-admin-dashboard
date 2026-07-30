import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Flag } from 'lucide-react';
import { moderationApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { DataTable, FilterBar, Pagination } from '../components/DataTable';
import {
  Badge,
  Card,
  Field,
  Input,
  PageHeader,
  SearchInput,
  Select,
  StatusBadge,
} from '../components/ui';
import { useTableState } from '../hooks/useTableState';
import { fmtRelative, shortId, titleCase } from '../lib/format';

const REASONS = [
  'ABUSIVE_LANGUAGE',
  'HARASSMENT',
  'SEXUAL_CONTENT',
  'SPAM_OR_SCAM',
  'IMPERSONATION',
  'UNDERAGE',
  'OTHER',
];

export function ModerationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const table = useTableState({
    status: searchParams.get('status') || '',
    reason: '',
    reportedUserId: '',
    reporterId: '',
    from: '',
    to: '',
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.moderation(table.params),
    queryFn: () => moderationApi.list(table.params),
  });

  const columns = [
    {
      key: 'reason',
      header: 'Reason',
      render: (row) => (
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-900">{titleCase(row.reason)}</p>
          {row.description && (
            <p className="truncate text-xs text-ink-500" title={row.description}>
              {row.description}
            </p>
          )}
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'reported',
      header: 'Reported user',
      render: (row) => (
        <span className="text-xs text-ink-700">
          {row.reportedUser?.name || shortId(row.reportedUserId)}
        </span>
      ),
    },
    {
      key: 'reporter',
      header: 'Reporter',
      render: (row) => (
        <span className="text-xs text-ink-600">
          {row.reporter?.name || shortId(row.reporterId)}
        </span>
      ),
    },
    {
      key: 'call',
      header: 'Call',
      render: (row) =>
        row.callSessionId ? (
          <span className="font-mono text-[11px] text-ink-600">{shortId(row.callSessionId)}</span>
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
    {
      key: 'action',
      header: 'Action taken',
      render: (row) =>
        row.actionTaken && row.actionTaken !== 'NONE' ? (
          <Badge tone="info">{titleCase(row.actionTaken)}</Badge>
        ) : (
          <span className="text-xs text-ink-400">—</span>
        ),
    },
    {
      key: 'createdAt',
      header: 'Reported',
      render: (row) => <span className="text-xs text-ink-600">{fmtRelative(row.createdAt)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Moderation"
        description="User reports and their workflow: pending → under review → resolved or rejected."
      />

      <Card bodyClassName="">
        <FilterBar onReset={table.isFiltered ? table.reset : undefined}>
          <Field label="Status" className="w-40">
            <Select
              value={table.filters.status}
              onChange={(e) => table.setFilter('status', e.target.value)}
            >
              <option value="">All</option>
              <option value="PENDING">Pending</option>
              <option value="UNDER_REVIEW">Under review</option>
              <option value="RESOLVED">Resolved</option>
              <option value="REJECTED">Rejected</option>
            </Select>
          </Field>

          <Field label="Reason" className="w-48">
            <Select
              value={table.filters.reason}
              onChange={(e) => table.setFilter('reason', e.target.value)}
            >
              <option value="">All reasons</option>
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {titleCase(r)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Reported user id" className="w-44">
            <SearchInput
              value={table.filters.reportedUserId}
              onChange={(v) => table.setFilter('reportedUserId', v)}
              placeholder="UUID"
            />
          </Field>

          <Field label="From" className="w-36">
            <Input
              type="date"
              value={table.filters.from}
              onChange={(e) => table.setFilter('from', e.target.value)}
            />
          </Field>
          <Field label="To" className="w-36">
            <Input
              type="date"
              value={table.filters.to}
              onChange={(e) => table.setFilter('to', e.target.value)}
            />
          </Field>
        </FilterBar>

        <DataTable
          columns={columns}
          rows={data?.data}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          onRowClick={(row) => navigate(`/moderation/${row.id}`)}
          emptyIcon={Flag}
          emptyTitle="No reports match these filters"
          emptyDescription="A quiet moderation queue is a good sign."
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
