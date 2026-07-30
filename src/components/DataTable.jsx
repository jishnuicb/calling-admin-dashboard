import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { Button, EmptyState, ErrorState, LoadingBlock } from './ui';

/**
 * The list primitive used by every table view.
 *
 * Columns are declared as `{ key, header, render, align, className, width }`.
 * `render(row)` receives the whole row so a cell can combine fields - most of the
 * admin tables want that (phone + name in one cell, tokens + bonus in another).
 *
 * Loading, empty, and error are handled here rather than in each page, so all 14
 * list views behave identically when the API is slow or down.
 */
export function DataTable({
  columns,
  rows,
  loading,
  error,
  onRetry,
  emptyTitle = 'Nothing to show',
  emptyDescription,
  emptyIcon = Inbox,
  emptyAction,
  onRowClick,
  rowKey = (row, i) => row.id || i,
  footer,
  dense,
}) {
  if (error) {
    return (
      <div className="p-5">
        <ErrorState error={error} onRetry={onRetry} />
      </div>
    );
  }

  if (loading) return <LoadingBlock />;

  if (!rows || rows.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink-200 bg-ink-50/70">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                style={col.width ? { width: col.width } : undefined}
                className={clsx(
                  'whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-ink-500',
                  col.align === 'right' && 'text-right',
                  col.align === 'center' && 'text-center',
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={rowKey(row, i)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={clsx(
                'border-b border-ink-100 last:border-0',
                onRowClick && 'cursor-pointer hover:bg-brand-50/40',
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={clsx(
                    'px-4 align-middle text-ink-700',
                    dense ? 'py-2' : 'py-3',
                    col.align === 'right' && 'text-right tabular',
                    col.align === 'center' && 'text-center',
                    col.className,
                  )}
                >
                  {col.render ? col.render(row) : (row[col.key] ?? <span className="text-ink-400">—</span>)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer}
      </table>
    </div>
  );
}

/**
 * Pagination bar driven by the backend's `meta` envelope
 * (`{ page, limit, total, totalPages, hasNextPage, hasPreviousPage }`).
 */
export function Pagination({ meta, onPageChange, onLimitChange }) {
  if (!meta) return null;
  const { page = 1, limit = 20, total = 0, totalPages = 0 } = meta;

  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 px-4 py-3">
      <p className="text-xs text-ink-500">
        {total === 0 ? (
          'No results'
        ) : (
          <>
            Showing <span className="font-medium text-ink-700">{from}</span>–
            <span className="font-medium text-ink-700">{to}</span> of{' '}
            <span className="font-medium text-ink-700">{total}</span>
          </>
        )}
      </p>

      <div className="flex items-center gap-3">
        {onLimitChange && (
          <label className="flex items-center gap-1.5 text-xs text-ink-500">
            Rows
            <select
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="rounded-md border-0 bg-white py-1 pl-2 pr-6 text-xs ring-1 ring-inset ring-ink-300 focus:ring-2 focus:ring-brand-500"
            >
              {[20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="secondary"
            disabled={!meta.hasPreviousPage && page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="size-3.5" />
            Prev
          </Button>
          <span className="px-2 text-xs text-ink-500 tabular">
            {page} / {Math.max(totalPages, 1)}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={!meta.hasNextPage && page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Filter bar wrapper: consistent spacing and wrapping for every list page. */
export function FilterBar({ children, onReset, className }) {
  return (
    <div
      className={clsx(
        'flex flex-wrap items-end gap-3 border-b border-ink-200 bg-ink-50/40 px-4 py-3',
        className,
      )}
    >
      {children}
      {onReset && (
        <Button size="sm" variant="ghost" onClick={onReset} className="ml-auto">
          Reset filters
        </Button>
      )}
    </div>
  );
}
