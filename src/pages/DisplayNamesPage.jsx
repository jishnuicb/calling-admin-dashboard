import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, Type } from 'lucide-react';
import { displayNamesApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { useApiMutation } from '../hooks/useApiMutation';
import { useAuth } from '../auth/AuthContext';
import { P } from '../auth/permissions';
import { DataTable, FilterBar, Pagination } from '../components/DataTable';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  Toggle,
} from '../components/ui';
import { slicePage, useTableState } from '../hooks/useTableState';
import { cleanParams, fmtDateTime } from '../lib/format';

function NameFormModal({ open, onClose, row }) {
  const editing = Boolean(row);
  const [form, setForm] = useState(
    row
      ? {
          name: row.name || '',
          active: row.active ?? true,
          sortOrder: row.sortOrder ?? 0,
        }
      : { name: '', active: true, sortOrder: 0 },
  );

  const mutation = useApiMutation({
    mutationFn: (body) =>
      editing ? displayNamesApi.update(row.id, body) : displayNamesApi.create(body),
    successMessage: editing ? 'Display name updated' : 'Display name added',
    invalidate: [['display-names']],
    onSuccess: onClose,
  });

  const submit = () =>
    mutation.mutate({
      name: form.name.trim(),
      active: form.active,
      sortOrder: Number(form.sortOrder) || 0,
    });

  const fieldErrors = mutation.error?.fieldErrors || {};

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit display name' : 'Add display name'}
      description="New signups (no custom name) get a random name from the active list. Existing users are unchanged."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            loading={mutation.isPending}
            disabled={form.name.trim().length < 2}
          >
            {editing ? 'Save changes' : 'Add name'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {mutation.error && <ErrorState error={mutation.error} compact />}

        <Field label="Name" required error={fieldErrors.name} hint="2–40 characters. Shown truncated to 15 in the app if longer.">
          <Input
            autoFocus
            value={form.name}
            maxLength={40}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Manavalan"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Sort order" hint="Lower shows first in this list.">
            <Input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
            />
          </Field>
          <Field label="Active" hint="Inactive names are not used for new signups.">
            <div className="pt-2">
              <Toggle
                checked={form.active}
                onChange={(v) => setForm({ ...form, active: v })}
                label={form.active ? 'Active' : 'Inactive'}
              />
            </div>
          </Field>
        </div>
      </div>
    </Modal>
  );
}

export function DisplayNamesPage() {
  const { can } = useAuth();
  const writable = can(P.DISPLAY_NAMES_WRITE);
  const table = useTableState({ search: '', active: '' });
  const [modal, setModal] = useState(null);

  const params = cleanParams({
    search: table.filters.search || undefined,
    active:
      table.filters.active === ''
        ? undefined
        : table.filters.active === 'true'
          ? true
          : false,
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.displayNames(params),
    queryFn: () => displayNamesApi.list(params),
  });

  const rows = data?.data || [];
  const { rows: pagedRows, meta } = slicePage(rows, table.page, table.pageSize);

  const removeMutation = useApiMutation({
    mutationFn: (id) => displayNamesApi.remove(id),
    successMessage: 'Display name removed',
    invalidate: [['display-names']],
  });

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => <span className="font-medium text-ink-900">{row.name}</span>,
    },
    {
      key: 'active',
      header: 'Status',
      render: (row) => (
        <Badge tone={row.active ? 'success' : 'neutral'}>
          {row.active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'sortOrder',
      header: 'Sort',
      align: 'right',
      render: (row) => row.sortOrder,
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      render: (row) => (
        <span className="text-xs text-ink-500">{fmtDateTime(row.updatedAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        writable ? (
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => setModal(row)}>
              Edit
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={removeMutation.isPending}
              onClick={() => {
                if (window.confirm(`Remove “${row.name}” from the signup pool?`)) {
                  removeMutation.mutate(row.id);
                }
              }}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Signup display names"
        description="Random names assigned when a new user signs up without choosing a name. Only active names are used. Existing accounts are not renamed."
        actions={
          writable ? (
            <Button onClick={() => setModal('new')}>
              <Plus className="size-4" />
              Add name
            </Button>
          ) : null
        }
      />

      <Card className="mb-4">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50">
            <Type className="size-4.5 text-brand-700" />
          </span>
          <div>
            <p className="text-sm font-medium text-ink-900">{rows.length} names in pool</p>
            <p className="mt-0.5 text-xs text-ink-500">
              {rows.filter((r) => r.active).length} active · used at random for new signups
            </p>
          </div>
        </div>
      </Card>

      <Card bodyClassName="">
        <FilterBar onReset={table.isFiltered ? table.reset : undefined}>
          <Field label="Search" className="w-full sm:w-56">
            <SearchInput
              value={table.filters.search}
              onChange={(v) => table.setFilter('search', v)}
              placeholder="Name"
            />
          </Field>
          <Field label="Status" className="w-full sm:w-40">
            <Select
              value={table.filters.active}
              onChange={(e) => table.setFilter('active', e.target.value)}
            >
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </Select>
          </Field>
        </FilterBar>

        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <>
            <DataTable columns={columns} rows={pagedRows} loading={isLoading} />
            <Pagination
              page={table.page}
              pageSize={table.pageSize}
              total={meta.total}
              onPageChange={table.setPage}
              onPageSizeChange={table.setPageSize}
            />
          </>
        )}
      </Card>

      {modal && (
        <NameFormModal
          open
          row={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
