import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layers, Plus, Trash2, UserPlus, UserMinus } from 'lucide-react';
import { listenerGroupsApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { useApiMutation } from '../hooks/useApiMutation';
import { useAuth } from '../auth/AuthContext';
import { P } from '../auth/permissions';
import { AdminMaskedName } from '../components/AdminMaskedName';
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
  Textarea,
} from '../components/ui';
import { useDebounced, useTableState } from '../hooks/useTableState';
import { fmtNumber, shortId } from '../lib/format';

function GroupFormModal({ open, onClose, group, onCreated }) {
  const editing = Boolean(group);
  const [form, setForm] = useState(
    group
      ? { name: group.name || '', description: group.description || '' }
      : { name: '', description: '' },
  );

  const mutation = useApiMutation({
    mutationFn: (body) =>
      editing ? listenerGroupsApi.update(group.id, body) : listenerGroupsApi.create(body),
    successMessage: editing ? 'Group updated' : 'Group created',
    invalidate: [['listener-groups']],
    onSuccess: (created) => {
      onClose();
      if (!editing) onCreated?.(created);
    },
  });

  const submit = () =>
    mutation.mutate({
      name: form.name.trim(),
      description: form.description.trim() || null,
    });

  const fieldErrors = mutation.error?.fieldErrors || {};

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit group' : 'Create listener group'}
      description="Custom groups are listener-only. You can add or remove members after creating the group."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            loading={mutation.isPending}
            disabled={!form.name.trim()}
          >
            {editing ? 'Save changes' : 'Create group'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {mutation.error && <ErrorState error={mutation.error} compact />}
        <Field label="Name" required error={fieldErrors.name}>
          <Input
            autoFocus
            maxLength={120}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Night shift hosts"
          />
        </Field>
        <Field label="Description" hint="Optional. Shown only in this dashboard.">
          <Textarea
            rows={3}
            maxLength={500}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What this group is for"
          />
        </Field>
      </div>
    </Modal>
  );
}

function AddMemberModal({ open, onClose, group }) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 350);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.listenerGroupSearch({ search: debouncedSearch, groupId: group.id }),
    queryFn: () =>
      listenerGroupsApi.searchListeners({
        search: debouncedSearch,
        groupId: group.id,
        page: 1,
        limit: 20,
      }),
    enabled: open && Boolean(debouncedSearch.trim()),
  });

  const addMutation = useApiMutation({
    mutationFn: (listenerUserId) =>
      listenerGroupsApi.addMember(group.id, { listenerUserId }),
    successMessage: (member) =>
      `${member.displayName || member.name || 'Listener'} added to ${group.name}`,
    invalidate: [['listener-groups']],
  });

  const rows = data?.data || [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Add listener to ${group.name}`}
      description="Search by name, mobile number, email, public id, or user id."
      footer={
        <Button variant="secondary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Search">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Name, mobile, email, or user id"
          />
        </Field>

        {!debouncedSearch.trim() ? (
          <p className="text-sm text-ink-500">Type to find an approved listener to add.</p>
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} compact />
        ) : (
          <DataTable
            dense
            loading={isLoading}
            rows={rows}
            rowKey={(row) => row.listenerUserId}
            emptyTitle="No matching listeners"
            emptyDescription="Try another name, mobile, email, or user id. Listeners already in this group are hidden."
            columns={[
              {
                key: 'listener',
                header: 'Listener',
                render: (row) => (
                  <div className="min-w-0">
                    <p className="font-medium text-ink-900">
                      {row.displayName || row.name || 'Unnamed'}
                    </p>
                    <p className="truncate font-mono text-[11px] text-ink-500" title={row.listenerUserId}>
                      {row.publicId || shortId(row.listenerUserId)}
                    </p>
                  </div>
                ),
              },
              {
                key: 'contact',
                header: 'Contact',
                render: (row) => (
                  <div className="text-xs text-ink-600">
                    <p className="tabular">{row.mobile || '—'}</p>
                    {row.email ? <p className="truncate">{row.email}</p> : null}
                  </div>
                ),
              },
              {
                key: 'add',
                header: '',
                align: 'right',
                render: (row) => (
                  <Button
                    size="sm"
                    disabled={addMutation.isPending}
                    onClick={() => addMutation.mutate(row.listenerUserId)}
                  >
                    <UserPlus className="size-3.5" />
                    Add
                  </Button>
                ),
              },
            ]}
          />
        )}
      </div>
    </Modal>
  );
}

export function ListenerGroupsPage() {
  const { can, hidesUserContact } = useAuth();
  const writable = can(P.LISTENERS_APPROVE);
  const groupsTable = useTableState({ search: '' });
  const membersTable = useTableState({ search: '' });
  const [selectedId, setSelectedId] = useState(null);
  const [groupModal, setGroupModal] = useState(null);
  const [addOpen, setAddOpen] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.listenerGroups(groupsTable.params),
    queryFn: () => listenerGroupsApi.list(groupsTable.params),
  });

  const groups = data?.data || [];
  const effectiveId = selectedId || groups[0]?.id || null;

  const selectedQuery = useQuery({
    queryKey: qk.listenerGroup(effectiveId),
    queryFn: () => listenerGroupsApi.get(effectiveId),
    enabled: Boolean(effectiveId),
  });
  const selected =
    selectedQuery.data || groups.find((row) => row.id === effectiveId) || null;

  const membersQuery = useQuery({
    queryKey: qk.listenerGroupMembers(selected?.id, membersTable.params),
    queryFn: () => listenerGroupsApi.members(selected.id, membersTable.params),
    enabled: Boolean(selected?.id),
  });

  const removeGroup = useApiMutation({
    mutationFn: (id) => listenerGroupsApi.remove(id),
    successMessage: 'Group deleted',
    invalidate: [['listener-groups']],
    onSuccess: (_, id) => {
      if (selectedId === id) setSelectedId(null);
    },
  });

  const removeMember = useApiMutation({
    mutationFn: ({ groupId, listenerUserId }) =>
      listenerGroupsApi.removeMember(groupId, listenerUserId),
    successMessage: 'Listener removed from group',
    invalidate: [['listener-groups']],
  });

  const groupColumns = [
    {
      key: 'name',
      header: 'Group',
      render: (row) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-ink-900">{row.name}</span>
            {row.isDefault ? <Badge tone="brand">Default</Badge> : null}
          </div>
          {row.description ? (
            <p className="mt-0.5 truncate text-xs text-ink-500">{row.description}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'memberCount',
      header: 'Members',
      align: 'right',
      render: (row) => (
        <span className="tabular text-ink-700">{fmtNumber(row.memberCount)}</span>
      ),
    },
    {
      key: 'createdAtIst',
      header: 'Created (IST)',
      render: (row) => (
        <span className="whitespace-nowrap text-xs tabular text-ink-600">
          {row.createdAtIst || '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) =>
        writable && !row.isDefault ? (
          <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="secondary" onClick={() => setGroupModal(row)}>
              Edit
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={removeGroup.isPending}
              onClick={() => {
                if (window.confirm(`Delete group “${row.name}”? Members are removed from this group only.`)) {
                  removeGroup.mutate(row.id);
                }
              }}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ) : null,
    },
  ];

  const memberColumns = [
    {
      key: 'listener',
      header: 'Listener',
      render: (row) => (
        <div className="min-w-0">
          <AdminMaskedName name={row.displayName || row.name} />
          <p className="truncate font-mono text-[11px] text-ink-500" title={row.listenerUserId}>
            {row.publicId || shortId(row.listenerUserId)}
          </p>
          <Link
            to={`/users/${row.listenerUserId}`}
            className="text-[11px] text-brand-700 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.listenerUserId}
          </Link>
        </div>
      ),
    },
    ...(!hidesUserContact
      ? [
          {
            key: 'contact',
            header: 'Mobile / email',
            render: (row) => (
              <div className="text-xs text-ink-600">
                <p className="tabular">{row.mobile || '—'}</p>
                {row.email ? <p className="truncate">{row.email}</p> : <p className="text-ink-400">—</p>}
              </div>
            ),
          },
        ]
      : []),
    {
      key: 'addedAtIst',
      header: 'Added (IST)',
      render: (row) => (
        <span className="whitespace-nowrap text-xs tabular text-ink-800">
          {row.addedAtIst || '—'}
        </span>
      ),
    },
    ...(writable && selected && !selected.isDefault
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right',
            render: (row) => (
              <Button
                size="sm"
                variant="secondary"
                disabled={removeMember.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      `Remove ${row.displayName || row.name || 'this listener'} from ${selected.name}?`,
                    )
                  ) {
                    removeMember.mutate({
                      groupId: selected.id,
                      listenerUserId: row.listenerUserId,
                    });
                  }
                }}
              >
                <UserMinus className="size-3.5" />
                Remove
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Listener groups"
        description="The default group always includes every approved listener. Create extra groups to target subsets later. Added times are shown in IST."
        actions={
          writable ? (
            <Button onClick={() => setGroupModal({})}>
              <Plus className="size-4" />
              New group
            </Button>
          ) : null
        }
      />

      <Card bodyClassName="">
        <FilterBar onReset={groupsTable.isFiltered ? groupsTable.reset : undefined}>
          <Field label="Search groups" className="w-full sm:w-64">
            <SearchInput
              value={groupsTable.filters.search}
              onChange={(v) => groupsTable.setFilter('search', v)}
              placeholder="Group name"
            />
          </Field>
        </FilterBar>
        <DataTable
          columns={groupColumns}
          rows={groups}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          emptyIcon={Layers}
          emptyTitle="No listener groups"
          emptyDescription="The default All listeners group is created automatically on first load."
          onRowClick={(row) => {
            if (row.id === effectiveId) return;
            setSelectedId(row.id);
            membersTable.reset();
          }}
          rowKey={(row) => row.id}
        />
        <Pagination
          meta={data?.meta}
          onPageChange={groupsTable.setPage}
          onLimitChange={groupsTable.changeLimit}
        />
      </Card>

      {selected && (
        <Card className="mt-6" bodyClassName="">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-200 px-4 py-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold text-ink-900">{selected.name}</h2>
                {selected.isDefault ? <Badge tone="brand">Default</Badge> : null}
                <span className="text-xs text-ink-500 tabular">
                  {fmtNumber(selected.memberCount)} members
                </span>
              </div>
              <p className="mt-1 text-xs text-ink-500">
                {selected.isDefault
                  ? 'Every approved listener is in this group. Membership is automatic and cannot be edited.'
                  : selected.description || 'Custom listener group. Add or remove members below.'}
              </p>
            </div>
            {writable && !selected.isDefault ? (
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <UserPlus className="size-3.5" />
                Add member
              </Button>
            ) : null}
          </div>

          <FilterBar onReset={membersTable.isFiltered ? membersTable.reset : undefined}>
            <Field label="Search members" className="w-full sm:w-80">
              <SearchInput
                value={membersTable.filters.search}
                onChange={(v) => membersTable.setFilter('search', v)}
                placeholder="Name, mobile, email, or user id"
              />
            </Field>
          </FilterBar>

          <DataTable
            columns={memberColumns}
            rows={membersQuery.data?.data || []}
            loading={membersQuery.isLoading}
            error={membersQuery.error}
            onRetry={membersQuery.refetch}
            emptyIcon={Layers}
            emptyTitle={selected.isDefault ? 'No approved listeners' : 'No members in this group'}
            emptyDescription={
              selected.isDefault
                ? 'Approved listeners appear here automatically.'
                : 'Search by name, mobile, email, or user id to add a listener.'
            }
            rowKey={(row) => row.listenerUserId}
          />
          <Pagination
            meta={membersQuery.data?.meta}
            onPageChange={membersTable.setPage}
            onLimitChange={membersTable.changeLimit}
          />
        </Card>
      )}

      {groupModal && (
        <GroupFormModal
          open
          group={groupModal.id ? groupModal : null}
          onClose={() => setGroupModal(null)}
          onCreated={(created) => {
            if (created?.id) {
              setSelectedId(created.id);
              membersTable.reset();
            }
          }}
        />
      )}

      {addOpen && selected && !selected.isDefault && (
        <AddMemberModal open group={selected} onClose={() => setAddOpen(false)} />
      )}
    </>
  );
}
