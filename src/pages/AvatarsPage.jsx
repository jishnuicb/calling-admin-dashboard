import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { avatarsApi } from '../api/endpoints';
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
  Select,
  Toggle,
} from '../components/ui';
import { useTableState } from '../hooks/useTableState';
import { fmtDateTime } from '../lib/format';

function AvatarFormModal({ open, onClose, avatar }) {
  const editing = Boolean(avatar);
  const [form, setForm] = useState(
    avatar
      ? {
          audience: avatar.audience || 'USER',
          gender: avatar.gender || 'FEMALE',
          imageUrl: avatar.imageUrl || '',
          label: avatar.label || '',
          sortOrder: avatar.sortOrder ?? 0,
          active: avatar.active ?? true,
          file: null,
        }
      : {
          audience: 'USER',
          gender: 'FEMALE',
          imageUrl: '',
          label: '',
          sortOrder: 0,
          active: true,
          file: null,
        },
  );

  const mutation = useApiMutation({
    mutationFn: async () => {
      if (editing) {
        return avatarsApi.update(avatar.id, {
          audience: form.audience,
          gender: form.gender,
          imageUrl: form.imageUrl.trim() || undefined,
          label: form.label.trim() || null,
          sortOrder: Number(form.sortOrder) || 0,
          active: form.active,
        });
      }
      if (form.file) {
        const fd = new FormData();
        fd.append('file', form.file);
        fd.append('audience', form.audience);
        fd.append('gender', form.gender);
        if (form.label.trim()) fd.append('label', form.label.trim());
        fd.append('sortOrder', String(Number(form.sortOrder) || 0));
        fd.append('active', String(form.active));
        return avatarsApi.upload(fd);
      }
      return avatarsApi.create({
        audience: form.audience,
        gender: form.gender,
        imageUrl: form.imageUrl.trim(),
        label: form.label.trim() || undefined,
        sortOrder: Number(form.sortOrder) || 0,
        active: form.active,
      });
    },
    successMessage: editing ? 'Avatar updated' : 'Avatar created',
    invalidate: [['avatars']],
    onSuccess: onClose,
  });

  const canSubmit = editing ? true : Boolean(form.file) || Boolean(form.imageUrl.trim());
  const fieldErrors = mutation.error?.fieldErrors || {};
  const previewSrc = form.file ? URL.createObjectURL(form.file) : form.imageUrl;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit avatar' : 'Add avatar'}
      description="Separate catalogs for users and listeners, filtered by gender in the app."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={!canSubmit}>
            {editing ? 'Save changes' : 'Create avatar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {mutation.error && <ErrorState error={mutation.error} compact />}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Audience" required>
            <Select
              value={form.audience}
              onChange={(e) => setForm({ ...form, audience: e.target.value })}
            >
              <option value="USER">User (caller)</option>
              <option value="LISTENER">Listener</option>
            </Select>
          </Field>
          <Field label="Gender" required>
            <Select
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
            >
              <option value="FEMALE">Female</option>
              <option value="MALE">Male</option>
            </Select>
          </Field>
        </div>

        {!editing && (
          <Field label="Upload image" hint="JPEG/PNG/WebP/GIF, max 5 MB. Preferred over pasting a URL.">
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })}
            />
          </Field>
        )}

        <Field
          label={editing ? 'Image URL' : 'Or image URL'}
          hint={editing ? 'CDN URL shown in the app.' : 'Only used when no file is selected.'}
          error={fieldErrors.imageUrl}
        >
          <Input
            value={form.imageUrl}
            onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
            placeholder="https://cdn.example.com/avatars/female-01.png"
            disabled={!editing && Boolean(form.file)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Label" error={fieldErrors.label}>
            <Input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="Soft smile"
            />
          </Field>
          <Field label="Sort order" error={fieldErrors.sortOrder}>
            <Input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
            />
          </Field>
        </div>

        <div className="rounded-lg bg-ink-50 px-3.5 py-3">
          <Toggle
            checked={form.active}
            onChange={(v) => setForm({ ...form, active: v })}
            label="Active (selectable in the app)"
          />
        </div>

        {previewSrc && (
          <div className="flex items-center gap-3 rounded-lg border border-ink-100 p-3">
            <img src={previewSrc} alt="" className="size-14 rounded-full object-cover" />
            <p className="text-xs text-ink-500">Preview</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function AvatarsPage() {
  const { can } = useAuth();
  const table = useTableState({ audience: '', gender: '', active: '' }, { limit: 20 });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.avatars(table.params),
    queryFn: () => avatarsApi.list(table.params),
  });

  const toggleActive = useApiMutation({
    mutationFn: ({ id, active }) => avatarsApi.update(id, { active }),
    successMessage: (_d, vars) => (vars.active ? 'Avatar activated' : 'Avatar deactivated'),
    invalidate: [['avatars']],
  });

  const removeMutation = useApiMutation({
    mutationFn: (id) => avatarsApi.remove(id),
    successMessage: 'Avatar deleted',
    invalidate: [['avatars']],
  });

  const rows = data?.data || [];
  const writable = can(P.AVATARS_WRITE);
  const filters = table.filters;

  const columns = [
    {
      key: 'image',
      header: 'Avatar',
      render: (row) => (
        <div className="flex items-center gap-3">
          <img src={row.imageUrl} alt="" className="size-10 rounded-full object-cover bg-ink-100" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink-900">{row.label || 'Untitled'}</p>
            <p className="truncate text-[11px] text-ink-500">{row.id}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'audience',
      header: 'Audience',
      render: (row) => (
        <Badge tone={row.audience === 'LISTENER' ? 'info' : 'neutral'}>{row.audience}</Badge>
      ),
    },
    {
      key: 'gender',
      header: 'Gender',
      render: (row) => <Badge tone="neutral">{row.gender}</Badge>,
    },
    {
      key: 'active',
      header: 'Selectable',
      render: (row) =>
        writable ? (
          <Toggle
            checked={row.active}
            disabled={toggleActive.isPending}
            onChange={(next) => toggleActive.mutate({ id: row.id, active: next })}
          />
        ) : (
          <Badge tone={row.active ? 'success' : 'neutral'}>
            {row.active ? 'Active' : 'Inactive'}
          </Badge>
        ),
    },
    {
      key: 'sortOrder',
      header: 'Order',
      align: 'right',
      render: (row) => row.sortOrder ?? 0,
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      render: (row) => <span className="text-xs text-ink-600">{fmtDateTime(row.updatedAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) =>
        writable && (
          <div className="flex items-center justify-end gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                setEditing(row);
                setFormOpen(true);
              }}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600 hover:bg-red-50"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm('Delete this avatar from the catalog?')) {
                  removeMutation.mutate(row.id);
                }
              }}
              aria-label="Delete avatar"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Profile avatars"
        description="Manage gender-separated avatar catalogs for users and listeners."
        actions={
          writable && (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" />
              Add avatar
            </Button>
          )
        }
      />

      <Card bodyClassName="">
        <FilterBar>
          <Field label="Audience" className="w-40">
            <Select
              value={filters.audience}
              onChange={(e) => table.setFilter('audience', e.target.value)}
            >
              <option value="">All audiences</option>
              <option value="USER">User</option>
              <option value="LISTENER">Listener</option>
            </Select>
          </Field>
          <Field label="Gender" className="w-36">
            <Select
              value={filters.gender}
              onChange={(e) => table.setFilter('gender', e.target.value)}
            >
              <option value="">All genders</option>
              <option value="FEMALE">Female</option>
              <option value="MALE">Male</option>
            </Select>
          </Field>
          <Field label="State" className="w-36">
            <Select
              value={filters.active}
              onChange={(e) => table.setFilter('active', e.target.value)}
            >
              <option value="">All states</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </Select>
          </Field>
        </FilterBar>

        <DataTable
          columns={columns}
          rows={rows}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          emptyTitle="No avatars yet"
          emptyDescription="Upload gender-specific images for USER and LISTENER catalogs."
        />
        <Pagination
          meta={data?.meta}
          onPageChange={table.setPage}
          onLimitChange={table.changeLimit}
        />
      </Card>

      {formOpen && (
        <AvatarFormModal
          key={editing?.id || 'new'}
          open={formOpen}
          avatar={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
