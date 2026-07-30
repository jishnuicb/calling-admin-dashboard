import { useCallback, useEffect, useMemo, useState } from 'react';
import { cleanParams } from '../lib/format';

/** Debounces a value so typing in a search box does not fire a request per keystroke. */
export function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * Filter + pagination state for a list page.
 *
 * Resets to page 1 whenever a filter changes - otherwise narrowing a filter while
 * on page 4 shows an empty table and looks like a bug. `params` is debounced and
 * cleaned (empty strings dropped) so it can be spread straight into an API call
 * and used as a React Query key.
 */
export function useTableState(initialFilters = {}, { limit = 20 } = {}) {
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(limit);

  const setFilter = useCallback((key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }, []);

  const setManyFilters = useCallback((updates) => {
    setFilters((current) => ({ ...current, ...updates }));
    setPage(1);
  }, []);

  const reset = useCallback(() => {
    setFilters(initialFilters);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialFilters)]);

  const debouncedFilters = useDebounced(filters, 350);

  const params = useMemo(
    () => cleanParams({ ...debouncedFilters, page, limit: pageSize }),
    [debouncedFilters, page, pageSize],
  );

  const changeLimit = useCallback((next) => {
    setPageSize(next);
    setPage(1);
  }, []);

  const isFiltered = useMemo(
    () =>
      Object.entries(filters).some(([key, value]) => {
        const initial = initialFilters[key];
        return (value ?? '') !== (initial ?? '');
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters, JSON.stringify(initialFilters)],
  );

  return {
    filters,
    setFilter,
    setManyFilters,
    reset,
    isFiltered,
    page,
    setPage,
    pageSize,
    changeLimit,
    params,
  };
}
