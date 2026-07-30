import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { auditApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { DataTable, FilterBar, Pagination } from '../components/DataTable';
import {
  Badge,
  Button,
  Card,
  DescList,
  Field,
  Input,
  JsonBlock,
  Modal,
  PageHeader,
  SearchInput,
} from '../components/ui';
import { useTableState } from '../hooks/useTableState';
import { fmtDateTimeSeconds, shortId, titleCase } from '../lib/format';

/**
 * The audit log is append-only: every mutating admin action writes a row with the
 * acting admin, the target, and before/after snapshots. This page is the read
 * side of that — there is deliberately no way to edit or delete an entry.
 */
function EntryModal({ entry, onClose }) {
  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={`${titleCase(entry.action)} · ${titleCase(entry.module)}`}
      description={fmtDateTimeSeconds(entry.createdAt)}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-5">
        <DescList
          items={[
            {
              label: 'Admin',
              value: entry.adminUser
                ? `${entry.adminUser.name} (${entry.adminUser.email})`
                : shortId(entry.adminUserId),
            },
            { label: 'Module', value: titleCase(entry.module) },
            { label: 'Action', value: titleCase(entry.action) },
            { label: 'Target id', value: entry.targetId, mono: true },
            { label: 'Target type', value: entry.targetType },
            { label: 'IP address', value: entry.ipAddress, mono: true },
            { label: 'When', value: fmtDateTimeSeconds(entry.createdAt) },
            { label: 'User agent', value: entry.userAgent, mono: true, full: true },
          ]}
        />

        {(entry.before || entry.after) && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
                Before
              </p>
              <JsonBlock value={entry.before} maxHeight="18rem" />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
                After
              </p>
              <JsonBlock value={entry.after} maxHeight="18rem" />
            </div>
          </div>
        )}

        {!entry.before && !entry.after && (
          <p className="text-sm text-ink-500">
            This action recorded no before/after snapshot, which is expected for reads and for
            actions with no prior state.
          </p>
        )}
      </div>
    </Modal>
  );
}

const ACTION_TONES = {
  CREATE: 'success',
  APPROVE: 'success',
  REACTIVATE: 'success',
  UPDATE: 'info',
  REVIEW: 'info',
  DELETE: 'danger',
  BLOCK: 'danger',
  SUSPEND: 'danger',
  REJECT: 'danger',
  TERMINATE: 'danger',
  REFUND: 'warning',
  ADJUST: 'warning',
};

export function AuditPage() {
  const [viewing, setViewing] = useState(null);
  const table = useTableState({
    adminUserId: '',
    module: '',
    action: '',
    targetId: '',
    from: '',
    to: '',
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.audit(table.params),
    queryFn: () => auditApi.list(table.params),
  });

  const columns = [
    {
      key: 'when',
      header: 'When',
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-ink-600">
          {fmtDateTimeSeconds(row.createdAt)}
        </span>
      ),
    },
    {
      key: 'admin',
      header: 'Admin',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-ink-800">
            {row.adminUser?.name || shortId(row.adminUserId)}
          </p>
          {row.adminUser?.email && (
            <p className="truncate text-[11px] text-ink-500">{row.adminUser.email}</p>
          )}
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (row) => (
        <Badge tone={ACTION_TONES[row.action] || 'neutral'}>{titleCase(row.action)}</Badge>
      ),
    },
    {
      key: 'module',
      header: 'Module',
      render: (row) => <span className="text-xs text-ink-700">{titleCase(row.module)}</span>,
    },
    {
      key: 'target',
      header: 'Target',
      render: (row) =>
        row.targetId ? (
          <span className="font-mono text-[11px] text-ink-600" title={row.targetId}>
            {row.targetType ? `${row.targetType} ` : ''}
            {shortId(row.targetId)}
          </span>
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
    {
      key: 'changed',
      header: 'Change',
      render: (row) => {
        // A quick sense of what moved, without opening the entry.
        if (!row.before && !row.after) return <span className="text-xs text-ink-400">—</span>;
        if (!row.before) return <Badge tone="success">created</Badge>;
        if (!row.after) return <Badge tone="danger">removed</Badge>;

        const changedKeys = Object.keys(row.after).filter(
          (key) => JSON.stringify(row.after[key]) !== JSON.stringify(row.before[key]),
        );
        return changedKeys.length === 0 ? (
          <span className="text-xs text-ink-400">no change</span>
        ) : (
          <span className="text-xs text-ink-600" title={changedKeys.join(', ')}>
            {changedKeys.slice(0, 2).join(', ')}
            {changedKeys.length > 2 && ` +${changedKeys.length - 2}`}
          </span>
        );
      },
    },
    {
      key: 'ip',
      header: 'IP',
      render: (row) => (
        <span className="font-mono text-[11px] text-ink-500">{row.ipAddress || '—'}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Append-only record of every mutating admin action, with before and after snapshots. Entries cannot be edited or removed."
      />

      <Card bodyClassName="">
        <FilterBar onReset={table.isFiltered ? table.reset : undefined}>
          <Field label="Module" className="w-40">
            <SearchInput
              value={table.filters.module}
              onChange={(v) => table.setFilter('module', v)}
              placeholder="wallet"
            />
          </Field>
          <Field label="Action" className="w-36">
            <SearchInput
              value={table.filters.action}
              onChange={(v) => table.setFilter('action', v)}
              placeholder="ADJUST"
            />
          </Field>
          <Field label="Admin id" className="w-44">
            <SearchInput
              value={table.filters.adminUserId}
              onChange={(v) => table.setFilter('adminUserId', v)}
              placeholder="UUID"
            />
          </Field>
          <Field label="Target id" className="w-44">
            <SearchInput
              value={table.filters.targetId}
              onChange={(v) => table.setFilter('targetId', v)}
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
          onRowClick={(row) => setViewing(row)}
          emptyIcon={ScrollText}
          emptyTitle="No audit entries match these filters"
          dense
        />

        <Pagination
          meta={data?.meta}
          onPageChange={table.setPage}
          onLimitChange={table.changeLimit}
        />
      </Card>

      {viewing && <EntryModal entry={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}
