import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { rbacApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { useApiMutation } from '../hooks/useApiMutation';
import { useAuth } from '../auth/AuthContext';
import { P } from '../auth/permissions';
import { DataTable, Pagination } from '../components/DataTable';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ErrorState,
  Field,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
  Select,
  StatusBadge,
  Tabs,
} from '../components/ui';
import { slicePage, useTableState } from '../hooks/useTableState';
import { fmtDateTime, titleCase } from '../lib/format';

/**
 * `GET /admin/permissions` returns permissions grouped by module
 * (`{ wallet: [...], users: [...] }`), and the module name exists only as the
 * group key - the rows themselves carry `key`, `action` and `description` but no
 * `module`. Flattening it here means the role editor and the catalogue both work
 * off one predictable shape. A flat array is tolerated too, so this keeps working
 * if the endpoint is ever changed.
 */
const flattenPermissions = (payload) => {
  const data = payload?.data ?? payload;
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return Object.entries(data).flatMap(([module, list]) =>
    (list || []).map((permission) => ({ ...permission, module: permission.module || module })),
  );
};

// --- Roles ------------------------------------------------------------------

function RoleFormModal({ role, permissions, onClose }) {
  const editing = Boolean(role);
  const [form, setForm] = useState({
    name: role?.name || '',
    description: role?.description || '',
    permissions: new Set(
      (role?.permissions || []).map((p) => p.permission?.key || p.key || p),
    ),
  });

  const mutation = useApiMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        description: form.description || undefined,
        permissions: [...form.permissions],
      };
      return editing ? rbacApi.updateRole(role.id, body) : rbacApi.createRole(body);
    },
    successMessage: editing ? 'Role updated' : 'Role created',
    invalidate: [qk.roles, ['rbac']],
    onSuccess: onClose,
  });

  const toggle = (key) => {
    setForm((current) => {
      const next = new Set(current.permissions);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...current, permissions: next };
    });
  };

  // Group by module so a 28-key list reads as a handful of decisions.
  const grouped = useMemo(() => {
    const map = new Map();
    (permissions || []).forEach((p) => {
      const list = map.get(p.module) || [];
      list.push(p);
      map.set(p.module, list);
    });
    return [...map.entries()];
  }, [permissions]);

  const toggleModule = (modulePermissions, on) => {
    setForm((current) => {
      const next = new Set(current.permissions);
      modulePermissions.forEach((p) => (on ? next.add(p.key) : next.delete(p.key)));
      return { ...current, permissions: next };
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={editing ? `Edit role: ${role.name}` : 'Create a role'}
      description="A role is a named set of permissions. Admins are assigned exactly one role."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={!form.name.trim()}>
            {editing ? 'Save role' : 'Create role'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {mutation.error && <ErrorState error={mutation.error} compact />}

        {role?.isSystem && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            This is a system role created by the seed. Editing it changes access for every admin
            assigned to it.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required>
            <Input
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="CONTENT_MODERATOR"
            />
          </Field>
          <Field label="Description">
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Moderation queue only"
            />
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-ink-700">
              Permissions
              <span className="ml-2 text-xs font-normal text-ink-500">
                {form.permissions.size} of {permissions?.length || 0} selected
              </span>
            </p>
          </div>

          <div className="max-h-80 space-y-4 overflow-y-auto rounded-lg border border-ink-200 p-3.5">
            {grouped.map(([module, modulePermissions]) => {
              const allOn = modulePermissions.every((p) => form.permissions.has(p.key));
              return (
                <div key={module}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                      {titleCase(module)}
                    </p>
                    <button
                      type="button"
                      onClick={() => toggleModule(modulePermissions, !allOn)}
                      className="text-[11px] font-medium text-brand-600 hover:underline"
                    >
                      {allOn ? 'Clear all' : 'Select all'}
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {modulePermissions.map((p) => (
                      <Checkbox
                        key={p.key}
                        checked={form.permissions.has(p.key)}
                        onChange={() => toggle(p.key)}
                        label={p.key}
                        description={p.description}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function RolesTab() {
  const { can } = useAuth();
  const table = useTableState({}, { limit: 20 });
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const { data: roles, isLoading, error, refetch } = useQuery({
    queryKey: qk.roles,
    queryFn: () => rbacApi.roles(),
  });

  const { data: permissions } = useQuery({
    queryKey: qk.permissions,
    queryFn: () => rbacApi.permissions(),
  });

  const remove = useApiMutation({
    mutationFn: (id) => rbacApi.deleteRole(id),
    successMessage: 'Role deleted',
    invalidate: [qk.roles],
    onSuccess: () => setDeleting(null),
  });

  const permissionList = flattenPermissions(permissions);
  const writable = can(P.ADMINS_WRITE);
  const { rows, meta } = slicePage(roles?.data || roles || [], table.page, table.pageSize);

  const columns = [
    {
      key: 'name',
      header: 'Role',
      render: (row) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-ink-900">{row.name}</span>
            {row.isSystem && <Badge tone="neutral">system</Badge>}
          </div>
          {row.description && <p className="truncate text-xs text-ink-500">{row.description}</p>}
        </div>
      ),
    },
    {
      key: 'permissions',
      header: 'Permissions',
      align: 'right',
      render: (row) => (
        <Badge tone="brand">{row.permissions?.length ?? row._count?.permissions ?? 0}</Badge>
      ),
    },
    {
      key: 'admins',
      header: 'Admins',
      align: 'right',
      render: (row) => row.adminCount ?? row._count?.admins ?? 0,
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (row) => <span className="text-xs text-ink-600">{fmtDateTime(row.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) =>
        writable && (
          <div className="flex items-center justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => setEditing(row)}>
              Edit
            </Button>
            {!row.isSystem && (
              <Button
                size="sm"
                variant="ghost"
                className="text-red-600 hover:bg-red-50"
                onClick={() => setDeleting(row)}
                aria-label={`Delete ${row.name}`}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        ),
    },
  ];

  return (
    <>
      <Card
        title="Roles"
        description="System roles come from the seed. Create your own for narrower access."
        actions={
          writable && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              New role
            </Button>
          )
        }
        bodyClassName=""
      >
        <DataTable
          columns={columns}
          rows={rows}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          emptyIcon={ShieldCheck}
          emptyTitle="No roles defined"
        />
        <Pagination
          meta={meta}
          onPageChange={table.setPage}
          onLimitChange={table.changeLimit}
        />
      </Card>

      {(editing || creating) && (
        <RoleFormModal
          role={editing}
          permissions={permissionList}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}

      {deleting && (
        <Modal
          open
          onClose={() => setDeleting(null)}
          title={`Delete role ${deleting.name}?`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeleting(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={remove.isPending}
                onClick={() => remove.mutate(deleting.id)}
              >
                Delete role
              </Button>
            </>
          }
        >
          {remove.error && <ErrorState error={remove.error} compact />}
          <p className="text-sm text-ink-600">
            The API refuses to delete a role that still has admins assigned. Reassign them first.
          </p>
        </Modal>
      )}
    </>
  );
}

// --- Admin users ------------------------------------------------------------

const FALLBACK_SECTIONS = [
  { key: 'OVERVIEW', label: 'Overview' },
  { key: 'PEOPLE', label: 'People' },
  { key: 'MONEY', label: 'Money' },
  { key: 'ACTIVITY', label: 'Activity' },
  { key: 'SYSTEM', label: 'System' },
];

function AdminFormModal({ adminUser, roles, onClose }) {
  const editing = Boolean(adminUser);
  const { admin: currentAdmin } = useAuth();
  const [form, setForm] = useState({
    email: adminUser?.email || '',
    name: adminUser?.name || '',
    password: '',
    roleId: adminUser?.roleId || adminUser?.role?.id || '',
    status: adminUser?.status || 'ACTIVE',
    isSuperAdmin: adminUser?.isSuperAdmin ?? false,
    sections: adminUser?.sections ? [...adminUser.sections] : FALLBACK_SECTIONS.map((s) => s.key),
  });

  const { data: sectionsResponse } = useQuery({
    queryKey: qk.sections,
    queryFn: () => rbacApi.sections(),
  });
  const sectionOptions = sectionsResponse?.data || FALLBACK_SECTIONS;

  const setSectionChecked = (key, checked) => {
    setForm((prev) => ({
      ...prev,
      sections: checked
        ? [...new Set([...prev.sections, key])]
        : prev.sections.filter((s) => s !== key),
    }));
  };

  const mutation = useApiMutation({
    mutationFn: () => {
      if (editing) {
        const body = {
          name: form.name,
          roleId: form.roleId,
          status: form.status,
          isSuperAdmin: form.isSuperAdmin,
          sections: form.sections,
        };
        if (form.password) body.password = form.password;
        return rbacApi.updateAdmin(adminUser.id, body);
      }
      return rbacApi.createAdmin({
        email: form.email.trim(),
        password: form.password,
        name: form.name.trim(),
        roleId: form.roleId,
        isSuperAdmin: form.isSuperAdmin,
        sections: form.sections,
      });
    },
    successMessage: editing ? 'Admin updated' : 'Admin created',
    invalidate: [['rbac', 'admins']],
    onSuccess: onClose,
  });

  const fieldErrors = mutation.error?.fieldErrors || {};
  const editingSelf = editing && adminUser.id === currentAdmin?.id;

  const canSubmit = editing
    ? Boolean(form.roleId)
    : form.email.trim() && form.password && form.name.trim() && form.roleId;

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? `Edit ${adminUser.email}` : 'Create an admin user'}
      description="Admin accounts are entirely separate from app users and authenticate with email and password."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={!canSubmit}>
            {editing ? 'Save changes' : 'Create admin'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {mutation.error && <ErrorState error={mutation.error} compact />}

        <Field label="Email" required={!editing} error={fieldErrors.email}>
          <Input
            type="email"
            value={form.email}
            disabled={editing}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="ops@voiceplatform.local"
          />
        </Field>

        <Field label="Name" required={!editing} error={fieldErrors.name}>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Operations Lead"
          />
        </Field>

        <Field
          label={editing ? 'Reset password' : 'Password'}
          required={!editing}
          hint="10+ characters with upper, lower, digit and symbol. Setting it revokes their sessions."
          error={fieldErrors.password}
        >
          <Input
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder={editing ? 'Leave blank to keep the current password' : ''}
          />
        </Field>

        <Field label="Role" required error={fieldErrors.roleId}>
          <Select
            value={form.roleId}
            onChange={(e) => setForm({ ...form, roleId: e.target.value })}
          >
            <option value="">Select a role…</option>
            {(roles || []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>

        {editing && (
          <Field label="Status">
            <Select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              disabled={editingSelf}
            >
              <option value="ACTIVE">Active</option>
              <option value="DISABLED">Disabled</option>
            </Select>
          </Field>
        )}

        <Field
          label="Permissions"
          hint="Dashboard sections this admin may open. Unauthorized sections are hidden and blocked."
          error={fieldErrors.sections}
        >
          <div className="space-y-2 rounded-lg border border-ink-200 bg-ink-50/60 px-3.5 py-3">
            {sectionOptions.map((section) => (
              <Checkbox
                key={section.key}
                checked={form.isSuperAdmin || form.sections.includes(section.key)}
                onChange={(checked) => setSectionChecked(section.key, checked)}
                label={section.label}
                disabled={form.isSuperAdmin}
              />
            ))}
            {form.isSuperAdmin && (
              <p className="text-xs text-ink-500">
                Super admins bypass section checks. Section assignments still apply if super access
                is later removed.
              </p>
            )}
          </div>
        </Field>

        <div className="rounded-lg bg-ink-50 px-3.5 py-3">
          <Checkbox
            checked={form.isSuperAdmin}
            onChange={(v) =>
              setForm({
                ...form,
                isSuperAdmin: v,
                sections: v ? sectionOptions.map((s) => s.key) : form.sections,
              })
            }
            label="Super admin"
            description="Bypasses every permission check regardless of role. Grant sparingly."
          />
        </div>

        {editingSelf && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            You are editing your own account. Removing your own permissions could lock you out of
            this console.
          </p>
        )}
      </div>
    </Modal>
  );
}

function AdminsTab() {
  const { can } = useAuth();
  const table = useTableState({}, { limit: 20 });
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.admins(table.params),
    queryFn: () => rbacApi.admins(table.params),
  });

  const { data: roles } = useQuery({ queryKey: qk.roles, queryFn: () => rbacApi.roles() });

  const roleList = roles?.data || roles || [];
  const writable = can(P.ADMINS_WRITE);

  const columns = [
    {
      key: 'email',
      header: 'Admin',
      render: (row) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-ink-900">{row.name}</span>
            {row.isSuperAdmin && <Badge tone="brand">super</Badge>}
          </div>
          <p className="truncate text-xs text-ink-500">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (row) => <Badge tone="info">{row.role?.name || '—'}</Badge>,
    },
    {
      key: 'sections',
      header: 'Sections',
      render: (row) =>
        row.isSuperAdmin ? (
          <span className="text-xs text-ink-500">All (super)</span>
        ) : (row.sections || []).length ? (
          <div className="flex flex-wrap gap-1">
            {row.sections.map((key) => (
              <Badge key={key} tone="neutral">
                {titleCase(key.toLowerCase())}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-xs text-ink-400">None</span>
        ),
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'lastLoginAt',
      header: 'Last login',
      render: (row) => (
        <span className="text-xs text-ink-600">
          {row.lastLoginAt ? fmtDateTime(row.lastLoginAt) : 'Never'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (row) => <span className="text-xs text-ink-600">{fmtDateTime(row.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) =>
        writable && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(row)}>
            Edit
          </Button>
        ),
    },
  ];

  return (
    <>
      <Card
        title="Admin users"
        actions={
          writable && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <UserPlus className="size-4" />
              New admin
            </Button>
          )
        }
        bodyClassName=""
      >
        <DataTable
          columns={columns}
          rows={data?.data}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          emptyIcon={ShieldCheck}
          emptyTitle="No admin users"
        />
        <Pagination
          meta={data?.meta}
          onPageChange={table.setPage}
          onLimitChange={table.changeLimit}
        />
      </Card>

      {(editing || creating) && (
        <AdminFormModal
          adminUser={editing}
          roles={roleList}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </>
  );
}

// --- Permission catalogue ---------------------------------------------------

function PermissionsTab() {
  const { data, isLoading, error } = useQuery({
    queryKey: qk.permissions,
    queryFn: () => rbacApi.permissions(),
  });

  if (isLoading) return <LoadingBlock />;
  if (error) return <ErrorState error={error} />;

  const permissions = flattenPermissions(data);
  const grouped = permissions.reduce((acc, p) => {
    (acc[p.module] = acc[p.module] || []).push(p);
    return acc;
  }, {});

  return (
    <Card
      title="Permission catalogue"
      description="The full set of keys the backend enforces. Read and write are always separate, and the dangerous actions get their own key."
    >
      <div className="grid gap-5 sm:grid-cols-2">
        {Object.entries(grouped).map(([module, list]) => (
          <div key={module}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
              {titleCase(module)}
            </p>
            <ul className="space-y-1.5">
              {list.map((p) => (
                <li key={p.key} className="rounded-lg bg-ink-50 px-3 py-2">
                  <p className="font-mono text-xs font-medium text-ink-800">{p.key}</p>
                  <p className="mt-0.5 text-xs text-ink-500">{p.description}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function RbacPage() {
  const [tab, setTab] = useState('admins');

  return (
    <>
      <PageHeader
        title="Admins & roles"
        description="Role-based access control. The API enforces these permissions on every route, so this console only reflects them."
      />

      <Tabs
        tabs={[
          { id: 'admins', label: 'Admin users' },
          { id: 'roles', label: 'Roles' },
          { id: 'permissions', label: 'Permission catalogue' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'admins' && <AdminsTab />}
      {tab === 'roles' && <RolesTab />}
      {tab === 'permissions' && <PermissionsTab />}
    </>
  );
}
