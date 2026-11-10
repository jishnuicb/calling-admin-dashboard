import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PhoneOff } from 'lucide-react';
import { listenersApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { DataTable, FilterBar, Pagination } from '../components/DataTable';
import { Badge, Card, Field, Input, PageHeader, SearchInput } from '../components/ui';
import { useTableState } from '../hooks/useTableState';
import { fmtDateTimeSeconds, shortId } from '../lib/format';

export function MissedCallAutoOfflinePage() {
  const table = useTableState({
    search: '',
    from: '',
    to: '',
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.missedCallAutoOffline(table.params),
    queryFn: () => listenersApi.listMissedCallAutoOffline(table.params),
  });

  const columns = [
    {
      key: 'when',
      header: 'Offline at (IST)',
      render: (row) => (
        <div className="whitespace-nowrap">
          <p className="text-sm text-ink-900">
            {row.offlineAtIst || `${fmtDateTimeSeconds(row.offlineAt)} IST`}
          </p>
        </div>
      ),
    },
    {
      key: 'listener',
      header: 'Listener',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink-900">
            {row.listenerName || shortId(row.listenerUserId)}
          </p>
          <p className="truncate text-[11px] text-ink-500">
            {row.listenerPublicId || shortId(row.listenerUserId)}
          </p>
          {row.applicationId ? (
            <Link
              to={`/listeners/${row.applicationId}`}
              className="text-[11px] text-brand-700 hover:underline"
            >
              Open application
            </Link>
          ) : null}
        </div>
      ),
    },
    {
      key: 'streak',
      header: 'Missed streak',
      render: (row) => (
        <span className="text-sm text-ink-800">
          {row.consecutiveMissedCallsBefore ?? '—'}
          {row.threshold != null ? <span className="text-ink-500"> / {row.threshold}</span> : null}
        </span>
      ),
    },
    {
      key: 'call',
      header: 'Trigger call',
      render: (row) =>
        row.callSessionId ? (
          <Link
            to={`/calls/${row.callSessionId}`}
            className="font-mono text-[11px] text-brand-700 hover:underline"
            title={row.callSessionId}
          >
            {shortId(row.callSessionId)}
          </Link>
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (row) => (
        <div className="space-y-1">
          <Badge tone="warning">{row.reason || 'consecutive_missed_calls'}</Badge>
          {row.endReason ? <p className="text-[11px] text-ink-500">{row.endReason}</p> : null}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Now',
      render: (row) => (
        <div className="space-y-1">
          {row.currentlyOnline == null ? (
            <span className="text-ink-400">—</span>
          ) : (
            <Badge tone={row.currentlyOnline ? 'success' : 'neutral'}>
              {row.currentlyOnline ? 'Online' : 'Offline'}
            </Badge>
          )}
          {row.applicationStatus ? (
            <p className="text-[11px] text-ink-500">{row.applicationStatus}</p>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Missed-call auto offline"
        description="Listeners set offline after consecutive MISSED (no-answer) calls. Times are IST. Read-only from audit history — does not change auto-offline rules."
      />

      <Card bodyClassName="">
        <FilterBar onReset={table.isFiltered ? table.reset : undefined}>
          <Field label="Search" className="min-w-[16rem] flex-1">
            <SearchInput
              value={table.filters.search}
              onChange={(value) => table.setFilter('search', value)}
              placeholder="Name, public id, mobile, user/application id"
            />
          </Field>
          <Field label="From" className="w-40">
            <Input
              type="date"
              value={table.filters.from}
              onChange={(e) => table.setFilter('from', e.target.value)}
            />
          </Field>
          <Field label="To" className="w-40">
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
          emptyIcon={PhoneOff}
          emptyTitle="No auto-offline events yet"
          emptyDescription="When consecutive missed calls force a listener offline, those events appear here."
          dense
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
