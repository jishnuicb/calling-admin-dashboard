import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { crashesApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { DataTable, FilterBar } from '../components/DataTable';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  PageHeader,
  Select,
} from '../components/ui';
import { useTableState } from '../hooks/useTableState';
import { fmtDateTime } from '../lib/format';

/**
 * App Crashes — Firebase Crashlytics rows via BigQuery (backend only).
 * Environment is fixed by the API deploy (staging vs production) — not selectable.
 */
export function AppCrashesPage() {
  const table = useTableState(
    {
      days: '14',
      fatal: 'all',
      action: '',
      trail: '',
      search: '',
      limit: '100',
    },
    { limit: 100 },
  );

  const params = useMemo(() => {
    const { days, fatal, action, trail, search, limit } = table.filters;
    return {
      days: Number(days) || 14,
      limit: Number(limit) || 100,
      fatal: fatal === 'all' ? undefined : fatal === 'true',
      action: action || undefined,
      trail: trail || undefined,
      search: search || undefined,
    };
  }, [table.filters]);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: qk.crashes(params),
    queryFn: () => crashesApi.list(params),
  });

  const rows = data?.data || [];
  const meta = data?.meta;
  const source = data?.source;
  const environment = meta?.environment || source?.environment || null;

  const columns = [
    {
      key: 'eventTimestamp',
      header: 'When',
      render: (row) => (
        <span className="whitespace-nowrap text-xs tabular text-ink-700">
          {row.eventTimestamp ? fmtDateTime(row.eventTimestamp) : '—'}
        </span>
      ),
    },
    {
      key: 'isFatal',
      header: 'Type',
      render: (row) =>
        row.isFatal ? (
          <Badge tone="danger">Fatal</Badge>
        ) : (
          <Badge tone="warning">Non-fatal</Badge>
        ),
    },
    {
      key: 'errorType',
      header: 'Error',
      render: (row) => (
        <div className="min-w-0 max-w-xs">
          <p className="truncate text-sm font-medium text-ink-900">{row.errorType || '—'}</p>
          {row.issueId ? (
            <p className="truncate font-mono text-[11px] text-ink-400">{row.issueId}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (row) => (
        <span className="font-mono text-xs text-ink-800">{row.action || '—'}</span>
      ),
    },
    {
      key: 'trail',
      header: 'Trail',
      render: (row) => (
        <p className="max-w-md truncate font-mono text-[11px] text-ink-600" title={row.trail || ''}>
          {row.trail || '—'}
        </p>
      ),
    },
    {
      key: 'userId',
      header: 'User',
      render: (row) => (
        <span className="font-mono text-xs text-ink-600">{row.userId || '—'}</span>
      ),
    },
    {
      key: 'device',
      header: 'Phone',
      render: (row) => (
        <span className="text-xs text-ink-700">
          {[row.deviceManufacturer, row.deviceModel].filter(Boolean).join(' ') || '—'}
        </span>
      ),
    },
    {
      key: 'appVersion',
      header: 'Version',
      render: (row) => <span className="text-xs tabular">{row.appVersion || '—'}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="App crashes"
        description="Crashlytics events from BigQuery (release builds only). Export can lag until the next day unless streaming is on."
        actions={
          <Button variant="secondary" size="sm" onClick={() => refetch()} loading={isFetching}>
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        }
      />

      {environment ? (
        <p className="text-sm text-ink-600">
          Environment:{' '}
          <Badge tone={meta?.flavor === 'prod' ? 'danger' : 'brand'}>{environment}</Badge>
          <span className="ml-2 text-xs text-ink-400">
            Fixed by this API deploy — not selectable.
          </span>
        </p>
      ) : null}

      {meta && meta.configured === false ? (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          BigQuery is not configured or credentials are missing. Link Crashlytics → BigQuery in
          Firebase, grant the service account <strong>BigQuery Data Viewer</strong>, and set{' '}
          <code className="font-mono">CRASHLYTICS_BQ_*</code> (or reuse{' '}
          <code className="font-mono">FIREBASE_*</code>).
        </Card>
      ) : null}

      {meta?.tableMissing ? (
        <Card className="border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
          {meta.note ||
            'Crashlytics BigQuery table is not created yet. Force a crash from a release build, then wait for Firebase export.'}
        </Card>
      ) : null}

      <FilterBar>
        <Field label="Days" className="w-28">
          <Select
            value={table.filters.days}
            onChange={(e) => table.setFilter('days', e.target.value)}
          >
            <option value="7">7</option>
            <option value="14">14</option>
            <option value="30">30</option>
            <option value="90">90</option>
          </Select>
        </Field>
        <Field label="Fatal" className="w-36">
          <Select
            value={table.filters.fatal}
            onChange={(e) => table.setFilter('fatal', e.target.value)}
          >
            <option value="all">All</option>
            <option value="true">Fatal only</option>
            <option value="false">Non-fatal only</option>
          </Select>
        </Field>
        <Field label="Action LIKE" className="min-w-[10rem] flex-1" hint="e.g. call.%">
          <Input
            value={table.filters.action}
            onChange={(e) => table.setFilter('action', e.target.value)}
            placeholder="call.%"
            className="font-mono text-sm"
          />
        </Field>
        <Field label="Trail LIKE" className="min-w-[12rem] flex-1" hint="e.g. %call.accept%">
          <Input
            value={table.filters.trail}
            onChange={(e) => table.setFilter('trail', e.target.value)}
            placeholder="%call.accept%"
            className="font-mono text-sm"
          />
        </Field>
        <Field label="Search" className="min-w-[10rem] flex-1">
          <Input
            value={table.filters.search}
            onChange={(e) => table.setFilter('search', e.target.value)}
            placeholder="error, user id, action…"
          />
        </Field>
      </FilterBar>

      {error ? <ErrorState error={error} onRetry={refetch} /> : null}

      <DataTable
        columns={columns}
        rows={rows}
        loading={isLoading}
        rowKey={(row, i) =>
          `${row.eventTimestamp || ''}-${row.issueId || ''}-${row.userId || ''}-${i}`
        }
        emptyTitle="No crash events"
        emptyDescription="No rows in the selected window, or BigQuery export has not landed yet."
      />

      {source?.table ? (
        <p className="text-[11px] text-ink-400">
          Source: <span className="font-mono">{source.table}</span>
          {environment ? ` · ${environment}` : null}
          {meta?.total != null ? ` · showing ${meta.total} row(s)` : null}
        </p>
      ) : null}
    </div>
  );
}
