import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Download, FileText } from 'lucide-react';
import { reportsApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { DataTable, Pagination } from '../components/DataTable';
import {
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  LoadingBlock,
  PageHeader,
} from '../components/ui';
import { useToast } from '../components/ui/Toast';
import { slicePage, useTableState } from '../hooks/useTableState';
import { fmtNumber, titleCase } from '../lib/format';

/**
 * Generic report runner.
 *
 * The backend describes each report as `{ rows, columns, summary }`, so one
 * component renders all of them: columns drive the table, summary drives the
 * cards above it. Adding a report type on the server needs no change here.
 */
export function ReportsPage() {
  const toast = useToast();
  const table = useTableState({}, { limit: 20 });
  const [selected, setSelected] = useState(null);
  const [range, setRange] = useState({ from: '', to: '' });
  const [downloading, setDownloading] = useState(false);

  const { data: typesData, isLoading: typesLoading, error: typesError } = useQuery({
    queryKey: qk.reportTypes,
    queryFn: () => reportsApi.types(),
  });

  const params = { ...(range.from ? { from: range.from } : {}), ...(range.to ? { to: range.to } : {}) };

  const { data: report, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: qk.reportData(selected, params),
    queryFn: () => reportsApi.generate(selected, params),
    enabled: Boolean(selected),
  });

  useEffect(() => {
    table.setPage(1);
    // Reset paging when the report selection or date range changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, range.from, range.to]);

  const { rows: pagedRows, meta } = slicePage(report?.rows || [], table.page, table.pageSize);

  const download = async () => {
    setDownloading(true);
    try {
      await reportsApi.download(selected, params);
      toast.success('Report downloaded');
    } catch (err) {
      toast.error(err);
    } finally {
      setDownloading(false);
    }
  };

  if (typesLoading) return <LoadingBlock label="Loading report types…" />;
  if (typesError) return <ErrorState error={typesError} />;

  const types = typesData?.data || typesData?.types || typesData || [];

  const normalisedTypes = types.map((t) =>
    typeof t === 'string' ? { type: t, name: titleCase(t), description: null } : t,
  );

  // The API returns column definitions; fall back to inferring from the first row.
  const columns = report
    ? (report.columns || Object.keys(report.rows?.[0] || {}).map((key) => ({ key, label: titleCase(key) }))).map(
        (col) => {
          const key = col.key || col;
          return {
            key,
            header: col.label || col.header || titleCase(key),
            align: col.align || (typeof report.rows?.[0]?.[key] === 'number' ? 'right' : undefined),
            render: (row) => {
              const value = row[key];
              if (value === null || value === undefined) return <span className="text-ink-400">—</span>;
              if (typeof value === 'number') return fmtNumber(value);
              if (typeof value === 'boolean') return value ? 'Yes' : 'No';
              if (typeof value === 'object') return JSON.stringify(value);
              return String(value);
            },
          };
        },
      )
    : [];

  return (
    <>
      <PageHeader
        title="Reports"
        description="Server-generated reports over the operational data. Every report can be exported as CSV."
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <Card title="Report type" className="lg:col-span-1" bodyClassName="p-2">
          <ul className="space-y-0.5">
            {normalisedTypes.map((t) => (
              <li key={t.type}>
                <button
                  type="button"
                  onClick={() => setSelected(t.type)}
                  className={`w-full rounded-lg px-3 py-2 text-left transition ${
                    selected === t.type
                      ? 'bg-brand-50 text-brand-800'
                      : 'text-ink-700 hover:bg-ink-50'
                  }`}
                >
                  <span className="block text-sm font-medium">{t.name || titleCase(t.type)}</span>
                  {t.description && (
                    <span className="mt-0.5 block text-xs text-ink-500">{t.description}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {normalisedTypes.length === 0 && (
            <p className="p-3 text-sm text-ink-500">No report types are exposed by the API.</p>
          )}
        </Card>

        <div className="space-y-4 lg:col-span-3">
          <Card title="Date range" description="Leave both blank to report over all time.">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="From" className="w-40">
                <Input
                  type="date"
                  value={range.from}
                  onChange={(e) => setRange({ ...range, from: e.target.value })}
                />
              </Field>
              <Field label="To" className="w-40">
                <Input
                  type="date"
                  value={range.to}
                  onChange={(e) => setRange({ ...range, to: e.target.value })}
                />
              </Field>
              {(range.from || range.to) && (
                <Button variant="ghost" onClick={() => setRange({ from: '', to: '' })}>
                  Clear
                </Button>
              )}
              <div className="ml-auto flex items-center gap-2">
                <Button variant="secondary" onClick={refetch} disabled={!selected} loading={isFetching}>
                  Run report
                </Button>
                <Button onClick={download} disabled={!selected} loading={downloading}>
                  <Download className="size-4" />
                  Export CSV
                </Button>
              </div>
            </div>
          </Card>

          {!selected ? (
            <Card>
              <div className="py-12 text-center">
                <BarChart3 className="mx-auto mb-3 size-7 text-ink-300" />
                <p className="text-sm font-medium text-ink-800">Choose a report to run</p>
                <p className="mt-1 text-sm text-ink-500">
                  Pick a type on the left, optionally set a date range, then run or export it.
                </p>
              </div>
            </Card>
          ) : (
            <>
              {report?.summary && Object.keys(report.summary).length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {Object.entries(report.summary).map(([key, value]) => (
                    <div key={key} className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
                      <p className="text-xs font-medium text-ink-500">{titleCase(key)}</p>
                      <p className="mt-1 truncate text-xl font-semibold tabular text-ink-900">
                        {typeof value === 'number'
                          ? fmtNumber(value)
                          : typeof value === 'object'
                            ? JSON.stringify(value)
                            : String(value ?? '—')}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <Card
                title={titleCase(selected)}
                description={
                  report?.rows ? `${fmtNumber(report.rows.length)} row(s)` : undefined
                }
                bodyClassName=""
              >
                <DataTable
                  columns={columns}
                  rows={pagedRows}
                  loading={isLoading}
                  error={error}
                  onRetry={refetch}
                  emptyIcon={FileText}
                  emptyTitle="This report returned no rows"
                  emptyDescription="Try widening the date range."
                  dense
                />
                <Pagination
                  meta={meta}
                  onPageChange={table.setPage}
                  onLimitChange={table.changeLimit}
                />
              </Card>
            </>
          )}
        </div>
      </div>
    </>
  );
}
