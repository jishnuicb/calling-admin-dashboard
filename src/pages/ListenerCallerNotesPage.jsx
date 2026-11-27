import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { StickyNote } from 'lucide-react';
import { listenersApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { useAuth } from '../auth/AuthContext';
import { AdminMaskedName } from '../components/AdminMaskedName';
import { ClippedText } from '../components/ClippedText';
import { DataTable, FilterBar, Pagination } from '../components/DataTable';
import { Card, Field, PageHeader, SearchInput } from '../components/ui';
import { useTableState } from '../hooks/useTableState';
import { fmtDateTimeSeconds, fmtNumber, shortId } from '../lib/format';

function PersonCell({ person, to, hidesContact }) {
  if (!person) return <span className="text-ink-400">—</span>;
  return (
    <div className="min-w-0">
      <AdminMaskedName
        name={person.displayName || person.name}
        emptyLabel={shortId(person.userId)}
      />
      {person.displayName && person.name && person.name !== person.displayName ? (
        <p className="truncate text-[11px] text-ink-500">{person.name}</p>
      ) : null}
      <p className="truncate font-mono text-[11px] text-ink-500" title={person.userId}>
        {person.publicId || shortId(person.userId)}
      </p>
      {!hidesContact && person.mobile ? (
        <p className="truncate text-[11px] tabular text-ink-500">{person.mobile}</p>
      ) : null}
      {!hidesContact && person.email ? (
        <p className="truncate text-[11px] text-ink-500">{person.email}</p>
      ) : null}
      {to ? (
        <Link to={to} className="text-[11px] text-brand-700 hover:underline">
          Open
        </Link>
      ) : (
        <Link
          to={`/users/${person.userId}`}
          className="text-[11px] text-brand-700 hover:underline"
        >
          Open user
        </Link>
      )}
    </div>
  );
}

export function ListenerCallerNotesPage() {
  const { hidesUserContact } = useAuth();
  const table = useTableState({ search: '' });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.listenerCallerNotes(table.params),
    queryFn: () => listenersApi.listCallerNotes(table.params),
  });

  const columns = [
    {
      key: 'updatedAtIst',
      header: 'Last edited (IST)',
      render: (row) => (
        <div className="whitespace-nowrap">
          <p className="text-sm tabular text-ink-900">
            {row.updatedAtIst || `${fmtDateTimeSeconds(row.updatedAt)} IST`}
          </p>
          <p className="text-[11px] text-ink-500">Edited</p>
        </div>
      ),
    },
    {
      key: 'createdAtIst',
      header: 'Added (IST)',
      render: (row) => (
        <div className="whitespace-nowrap">
          <p className="text-sm tabular text-ink-800">
            {row.createdAtIst || `${fmtDateTimeSeconds(row.createdAt)} IST`}
          </p>
          <p className="text-[11px] text-ink-500">First saved</p>
        </div>
      ),
    },
    {
      key: 'listener',
      header: 'Listener',
      render: (row) => (
        <PersonCell
          person={row.listener}
          to={row.listener?.applicationId ? `/listeners/${row.listener.applicationId}` : undefined}
          hidesContact={hidesUserContact}
        />
      ),
    },
    {
      key: 'caller',
      header: 'Caller',
      render: (row) => <PersonCell person={row.caller} hidesContact={hidesUserContact} />,
    },
    {
      key: 'note',
      header: 'Note',
      render: (row) =>
        row.note ? (
          <ClippedText
            text={row.note}
            max={160}
            className="whitespace-pre-wrap text-sm text-ink-800"
            title="Caller note"
          />
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
    {
      key: 'calls',
      header: 'Calls',
      render: (row) => (
        <div className="whitespace-nowrap text-xs text-ink-700">
          <p>{fmtNumber(row.callCount)} calls</p>
          {row.lastCallAtIst || row.lastCallAt ? (
            <p className="tabular text-[11px] text-ink-500">
              Last {row.lastCallAtIst || `${fmtDateTimeSeconds(row.lastCallAt)} IST`}
            </p>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Listener caller notes"
        description="Private notes listeners save about callers. Times are exact IST. Callers never see these notes."
      />

      <Card bodyClassName="">
        <FilterBar onReset={table.isFiltered ? table.reset : undefined}>
          <Field label="Search" className="w-full sm:w-80">
            <SearchInput
              value={table.filters.search}
              onChange={(v) => table.setFilter('search', v)}
              placeholder="Listener, caller, mobile, email, user id, or note text"
            />
          </Field>
        </FilterBar>

        <DataTable
          columns={columns}
          rows={data?.data}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          emptyIcon={StickyNote}
          emptyTitle="No caller notes yet"
          emptyDescription="When a listener saves a note about a caller during or after a call, it appears here."
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
