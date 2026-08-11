import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck } from 'lucide-react';
import { languagesApi, listenersApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { DataTable, FilterBar, Pagination } from '../components/DataTable';
import { Badge, Card, Field, PageHeader, SearchInput, Select, StatusBadge } from '../components/ui';
import { useTableState } from '../hooks/useTableState';
import { fmtRelative, titleCase } from '../lib/format';

export function ListenersPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Deep links from the dashboard (?status=PENDING) should land pre-filtered.
  const table = useTableState({
    status: searchParams.get('status') || '',
    search: '',
    country: '',
    gender: '',
    languages: '',
    availabilityEnabled: '',
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.listeners(table.params),
    queryFn: () => listenersApi.list(table.params),
  });

  // Populates the language filter from the master list rather than hardcoding.
  const { data: languages } = useQuery({
    queryKey: qk.languages({ active: true }),
    queryFn: () => languagesApi.list({ active: true }),
  });

  const columns = [
    {
      key: 'listener',
      header: 'Listener',
      render: (row) => (
        <div className="flex min-w-0 items-center gap-2.5">
          {row.photoUrl ? (
            <img
              src={row.photoUrl}
              alt=""
              className="size-8 shrink-0 rounded-full object-cover ring-1 ring-ink-200"
            />
          ) : (
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink-100 text-xs font-medium text-ink-500">
              {(row.displayName || '?').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-medium text-ink-900">{row.displayName}</p>
            <p className="truncate text-xs text-ink-500">
              {titleCase(row.gender)} · {row.country || 'Unknown country'}
            </p>
          </div>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'isProfessionalVerified',
      header: 'Profession verified',
      render: (row) =>
        row.isProfessionalVerified ? (
          <Badge tone="success" dot>
            Verified
          </Badge>
        ) : (
          <Badge tone="neutral">Not verified</Badge>
        ),
    },
    {
      key: 'languages',
      header: 'Languages',
      render: (row) =>
        row.languages?.length ? (
          <div className="flex flex-wrap gap-1">
            {row.languages.slice(0, 3).map((l) => (
              <Badge key={l.id || l.name} tone="brand">
                {l.name}
              </Badge>
            ))}
            {row.languages.length > 3 && (
              <Badge tone="neutral">+{row.languages.length - 3}</Badge>
            )}
          </div>
        ) : (
          // An approved listener cannot have zero languages; the backend blocks
          // approval in that state. Seeing this on a PENDING row is normal.
          <span className="text-xs text-amber-600">None selected</span>
        ),
    },
    {
      key: 'online',
      header: 'Availability',
      render: (row) => {
        if (row.status !== 'APPROVED') return <span className="text-xs text-ink-400">—</span>;
        if (row.online && row.busy) {
          return (
            <Badge tone="warning" dot>
              Busy
            </Badge>
          );
        }
        if (row.online) {
          return (
            <div className="min-w-0">
              <Badge tone="success" dot>
                Online
              </Badge>
              <p className="mt-0.5 text-[11px] text-ink-500" title={row.lastSeenAt || ''}>
                {row.lastSeenAt ? `seen ${fmtRelative(row.lastSeenAt)}` : 'manual online'}
              </p>
            </div>
          );
        }
        // Offline is only a manual choice. Socket disconnect does not flip this.
        return (
          <div className="min-w-0">
            <Badge tone="neutral">Offline</Badge>
            <p className="mt-0.5 text-[11px] text-ink-500" title={row.lastSeenAt || ''}>
              {row.lastSeenAt ? `seen ${fmtRelative(row.lastSeenAt)}` : 'not taking calls'}
            </p>
          </div>
        );
      },
    },
    {
      key: 'age',
      header: 'Age',
      align: 'right',
      render: (row) =>
        row.age == null ? (
          // Pre-dates the 18+ requirement; they must re-apply with a date of
          // birth before they can be approved.
          <span className="text-xs text-amber-600" title="No date of birth on file">
            n/a
          </span>
        ) : (
          <span className="tabular text-sm text-ink-800">{row.age}</span>
        ),
    },
    {
      key: 'mobileNumber',
      header: 'Mobile Number',
      render: (row) => (
        <span className="tabular text-sm text-ink-700">
          {row.user?.mobile ?? '—'}
        </span>
      ),
    },
    {
      key: 'payout',
      header: 'Payout',
      render: (row) =>
        row.bankDetails?.provided ? (
          <span className="text-xs tabular text-ink-600" title={row.bankDetails.bankName || ''}>
            {row.bankDetails.bankAccountNumberMasked}
          </span>
        ) : (
          <Badge tone="warning">Missing</Badge>
        ),
    },
    {
      key: 'submittedAt',
      header: 'Submitted',
      render: (row) => <span className="text-xs text-ink-600">{fmtRelative(row.submittedAt)}</span>,
    },
    {
      key: 'reapply',
      header: 'Re-applies',
      align: 'right',
      render: (row) =>
        row.reapplyCount ? (
          <Badge tone="warning">{row.reapplyCount}</Badge>
        ) : (
          <span className="text-xs text-ink-400">0</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Listener applications"
        description="Review the pipeline. Applicants must be 18+ with payout details on file, approval requires at least one selected language, and an approved listener is never forced online."
      />

      <Card bodyClassName="">
        <FilterBar onReset={table.isFiltered ? table.reset : undefined}>
          <Field label="Search" className="w-full sm:w-56">
            <SearchInput
              value={table.filters.search}
              onChange={(v) => table.setFilter('search', v)}
              placeholder="Display name or user id"
            />
          </Field>

          <Field label="Status" className="w-40">
            <Select
              value={table.filters.status}
              onChange={(e) => table.setFilter('status', e.target.value)}
            >
              <option value="">All</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="SUSPENDED">Suspended</option>
            </Select>
          </Field>

          <Field label="Language" className="w-40">
            <Select
              value={table.filters.languages}
              onChange={(e) => table.setFilter('languages', e.target.value)}
            >
              <option value="">All</option>
              {(languages?.data || []).map((l) => (
                <option key={l.id} value={l.name}>
                  {l.name}
                </option>
              ))}
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

          <Field label="Availability" className="w-44">
            <Select
              value={table.filters.availabilityEnabled}
              onChange={(e) => table.setFilter('availabilityEnabled', e.target.value)}
            >
              <option value="">Any</option>
              <option value="true">Go-online enabled</option>
              <option value="false">Not taking calls</option>
            </Select>
          </Field>

          <Field label="Country" className="w-36">
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
          onRowClick={(row) => navigate(`/listeners/${row.id}`)}
          emptyIcon={BadgeCheck}
          emptyTitle="No applications match these filters"
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
