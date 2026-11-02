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

// --- Subadmins --------------------------------------------------------------

/** Prefer Write over Read when merging parent + leaf for display. */
const mergeMenuAccess = (a, b) => {
  if (!a) return b || null;
  if (!b) return a;
  if (a === 'WRITE' || b === 'WRITE') return 'WRITE';
  return 'READ';
};

function SubadminFormModal({ subadmin, menusCatalogue, phoneKeyConfigured, onClose }) {
  const editing = Boolean(subadmin);
  const groups = menusCatalogue?.groups || [];
  const defaultGrants = menusCatalogue?.defaultGrants || [];

  const grantableChildren = (group) =>
    (group.children || []).filter((leaf) => !leaf.deniedForSubadmin);

  const initialGrantMap = () => {
    const map = {};
    const source = editing ? subadmin.menuGrants || [] : defaultGrants;
    source.forEach((g) => {
      // Legacy BOTH → Write in the form.
      map[g.menuKey] = g.access === 'BOTH' ? 'WRITE' : g.access;
    });
    // Parent (main menu) covers every submenu — show that on each child dropdown.
    for (const group of groups) {
      const parentAccess = map[group.key];
      if (!parentAccess) continue;
      for (const leaf of grantableChildren(group)) {
        map[leaf.key] = mergeMenuAccess(map[leaf.key], parentAccess);
      }
    }
    return map;
  };

  const [form, setForm] = useState({
    email: subadmin?.email || '',
    name: subadmin?.name || '',
    password: '',
    status: subadmin?.status || 'ACTIVE',
    grants: initialGrantMap(),
  });

  /**
   * Main-menu control for a whole section:
   * - All off → clears every submenu under it
   * - Read / Read and write → sets every submenu to that access
   */
  const setGroupGrant = (group, accessOrOff) => {
    setForm((current) => {
      const next = { ...current.grants };
      const children = grantableChildren(group);
      if (!accessOrOff || accessOrOff === '__custom__') {
        delete next[group.key];
        for (const leaf of children) delete next[leaf.key];
        return { ...current, grants: next };
      }
      next[group.key] = accessOrOff;
      for (const leaf of children) next[leaf.key] = accessOrOff;
      return { ...current, grants: next };
    });
  };

  /**
   * Leaf change: drop the parent group key so a lower child access is not
   * overridden on save by the main-menu expansion.
   */
  const setLeafGrant = (group, leafKey, accessOrOff) => {
    setForm((current) => {
      const next = { ...current.grants };
      if (next[group.key]) {
        const parentAccess = next[group.key];
        delete next[group.key];
        for (const leaf of grantableChildren(group)) {
          if (next[leaf.key] == null) next[leaf.key] = parentAccess;
        }
      }
      if (!accessOrOff) delete next[leafKey];
      else next[leafKey] = accessOrOff;
      return { ...current, grants: next };
    });
  };

  /** Derive main-menu dropdown from child state so UI matches reality. */
  const groupControlValue = (group) => {
    const children = grantableChildren(group);
    if (!children.length) return form.grants[group.key] || '';
    const accesses = children.map((leaf) => form.grants[leaf.key] || '');
    const allOff = accesses.every((a) => !a);
    if (allOff) return '';
    const first = accesses[0];
    const allSame = accesses.every((a) => a === first);
    if (allSame) return first;
    return '__custom__';
  };

  const mutation = useApiMutation({
    mutationFn: async () => {
      const menuGrants = Object.entries(form.grants).map(([menuKey, access]) => ({
        menuKey,
        access,
      }));
      if (editing) {
        const body = {
          name: form.name.trim(),
          status: form.status,
          menuGrants,
        };
        if (form.password) body.password = form.password;
        return rbacApi.updateSubadmin(subadmin.id, body);
      }
      return rbacApi.createSubadmin({
        email: form.email.trim(),
        password: form.password,
        name: form.name.trim(),
        menuGrants,
      });
    },
    successMessage: editing ? 'Subadmin updated' : 'Subadmin created',
    invalidate: [['rbac', 'subadmins']],
    onSuccess: () => onClose(),
  });

  const canSubmit = editing
    ? Boolean(form.name.trim()) && Object.keys(form.grants).length > 0
    : form.email.trim() &&
      form.password &&
      form.name.trim() &&
      Object.keys(form.grants).length > 0 &&
      phoneKeyConfigured;

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={editing ? `Edit subadmin: ${subadmin.email}` : 'Create a subadmin'}
      description="Subadmins are separate from full admins. Grant main menus or submenus as Read or Read and write. Delete account and Adjust balance are never available."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!canSubmit}
          >
            {editing ? 'Save changes' : 'Create subadmin'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {mutation.error && <ErrorState error={mutation.error} compact />}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" required={!editing}>
            <Input
              type="email"
              value={form.email}
              disabled={editing}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Name" required>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
        </div>

        <Field
          label={editing ? 'Reset password' : 'Password'}
          required={!editing}
          hint="10+ characters with upper, lower, digit and symbol."
        >
          <Input
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder={editing ? 'Leave blank to keep current' : ''}
          />
        </Field>

        {editing && (
          <Field label="Status">
            <Select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="ACTIVE">Active</option>
              <option value="DISABLED">Disabled</option>
            </Select>
          </Field>
        )}

        {!editing && (
          <p className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-700">
            Uses the <span className="font-medium">shared permanent phone-only key</span> (issue it
            once on the Subadmins tab). That key reveals listener phones only — user phone/email stay
            hidden; bank stays locked.
          </p>
        )}

        {!editing && !phoneKeyConfigured && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Issue the permanent phone key first (unlock admin decryption key → Issue phone key), then
            create subadmins.
          </p>
        )}

        <div>
          <p className="mb-2 text-sm font-medium text-ink-700">Menu access</p>
          <p className="mb-3 text-xs text-ink-500">
            Use the section control to set or clear every submenu at once:{' '}
            <span className="font-medium">All off</span> turns the whole section off,{' '}
            <span className="font-medium">All: Read</span> /{' '}
            <span className="font-medium">All: Read and write</span> apply to every submenu.
            After that you can still tweak one submenu (section shows{' '}
            <span className="font-medium">Custom</span>). Never grantable: account deletion,
            admins &amp; roles, wallets, bulk top-up. Subadmins cannot delete users or adjust
            balance even if Users is granted.
          </p>
          <div className="max-h-80 space-y-4 overflow-y-auto rounded-lg border border-ink-200 p-3">
            {groups.map((group) => {
              const controlValue = groupControlValue(group);
              return (
                <div key={group.key}>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                      {group.label}
                    </span>
                    <Select
                      className="w-auto"
                      value={controlValue}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '__custom__') return;
                        setGroupGrant(group, v || null);
                      }}
                    >
                      <option value="">All off</option>
                      <option value="READ">All: Read</option>
                      <option value="WRITE">All: Read and write</option>
                      {controlValue === '__custom__' && (
                        <option value="__custom__">Custom (mixed submenus)</option>
                      )}
                    </Select>
                  </div>
                  <ul className="space-y-1.5 pl-2">
                    {grantableChildren(group).map((leaf) => (
                      <li
                        key={leaf.key}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-ink-50 px-2.5 py-1.5"
                      >
                        <span className="text-sm text-ink-800">{leaf.label}</span>
                        <Select
                          className="w-auto"
                          value={form.grants[leaf.key] || ''}
                          onChange={(e) =>
                            setLeafGrant(group, leaf.key, e.target.value || null)
                          }
                        >
                          <option value="">Off</option>
                          <option value="READ">Read</option>
                          <option value="WRITE">Read and write</option>
                        </Select>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function SubadminsTab() {
  const { can } = useAuth();
  const table = useTableState({}, { limit: 20 });
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [issuedKey, setIssuedKey] = useState(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.subadmins(table.params),
    queryFn: () => rbacApi.subadmins(table.params),
  });

  const { data: menusCatalogue } = useQuery({
    queryKey: qk.menus,
    queryFn: () => rbacApi.menus(),
  });

  const {
    data: phoneKeyStatus,
    refetch: refetchPhoneKey,
  } = useQuery({
    queryKey: qk.subadminPhoneKey,
    queryFn: () => rbacApi.subadminPhoneKeyStatus(),
  });

  const writable = can(P.ADMINS_WRITE);
  const phoneKeyConfigured = Boolean(phoneKeyStatus?.configured);

  const issueMutation = useApiMutation({
    mutationFn: () => rbacApi.issueSubadminPhoneKey(),
    successMessage: 'Permanent phone key issued',
    invalidate: [['rbac', 'subadmins'], qk.subadminPhoneKey],
    onSuccess: (result) => {
      if (result?.phoneRevealKey) setIssuedKey(result.phoneRevealKey);
      refetchPhoneKey();
    },
  });

  const columns = [
    {
      key: 'email',
      header: 'Subadmin',
      render: (row) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-ink-900">{row.name}</span>
            <Badge tone="info">subadmin</Badge>
          </div>
          <p className="truncate text-xs text-ink-500">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'menus',
      header: 'Menus',
      render: (row) =>
        (row.menuGrants || []).length ? (
          <div className="flex flex-wrap gap-1">
            {row.menuGrants.slice(0, 8).map((g) => (
              <Badge key={g.menuKey} tone="neutral">
                {g.menuKey}:
                {g.access === 'READ' ? 'read' : 'read+write'}
              </Badge>
            ))}
            {row.menuGrants.length > 8 && (
              <Badge tone="neutral">+{row.menuGrants.length - 8}</Badge>
            )}
          </div>
        ) : (
          <span className="text-xs text-ink-400">None</span>
        ),
    },
    {
      key: 'phoneKey',
      header: 'Phone key',
      render: (row) =>
        row.hasPhoneRevealKey ? (
          <Badge tone="success">ready</Badge>
        ) : (
          <Badge tone="danger">missing</Badge>
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
        title="Permanent phone key"
        description="One shared encrypted phone-only key for every subadmin. Used only to reveal listener phone numbers — never user (caller) phone/email, and never bank details. Store locally and hand the same key to all subadmins."
        actions={
          writable && (
            <Button
              size="sm"
              variant={phoneKeyConfigured ? 'secondary' : 'primary'}
              loading={issueMutation.isPending}
              onClick={() => issueMutation.mutate()}
            >
              {phoneKeyConfigured ? 'Rotate phone key' : 'Issue phone key'}
            </Button>
          )
        }
      >
        <div className="space-y-2 px-4 py-3 text-sm text-ink-700">
          {issueMutation.error && <ErrorState error={issueMutation.error} compact />}
          <div className="flex flex-wrap items-center gap-2">
            <span>Status:</span>
            {phoneKeyConfigured ? (
              <Badge tone="success">configured</Badge>
            ) : (
              <Badge tone="danger">not issued</Badge>
            )}
            {phoneKeyStatus?.issuedAt && (
              <span className="text-xs text-ink-500">
                Last issued {fmtDateTime(phoneKeyStatus.issuedAt)}
              </span>
            )}
          </div>
          <p className="text-xs text-ink-500">
            Unlock the permanent decryption key in the console first (same as admin Reveal phone
            &amp; bank), then issue. Shown once — copy and store locally. Subadmins use it on
            listener applications only.
          </p>
        </div>
      </Card>

      <Card
        title="Subadmins"
        description="Restricted operators. Default menus: users (no email/phone until reveal), listener apps, active listeners, avatars, calls, moderation, blocks. Never: delete user, adjust balance, wallets, or bulk top-up."
        actions={
          writable && (
            <Button size="sm" onClick={() => setCreating(true)} disabled={!phoneKeyConfigured}>
              <UserPlus className="size-4" />
              New subadmin
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
          emptyTitle="No subadmins"
        />
        <Pagination
          meta={data?.meta}
          onPageChange={table.setPage}
          onLimitChange={table.changeLimit}
        />
      </Card>

      {issuedKey && (
        <Modal
          open
          onClose={() => setIssuedKey(null)}
          title="Permanent subadmin phone key"
          description="Store this locally and give the same key to every subadmin. Shown once — cannot retrieve later. Not the permanent admin master key."
          footer={<Button onClick={() => setIssuedKey(null)}>Done</Button>}
        >
          <div className="space-y-3">
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Listener phone only. User (caller) phone/email stay hidden. Bank / payout reveal stays
              blocked even with this key.
            </p>
            <Field label="Shared phone-only decryption key">
              <Input readOnly value={issuedKey} className="font-mono text-xs" />
            </Field>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigator.clipboard?.writeText(issuedKey)}
            >
              Copy to clipboard
            </Button>
          </div>
        </Modal>
      )}

      {(editing || creating) && (
        <SubadminFormModal
          subadmin={editing}
          menusCatalogue={menusCatalogue}
          phoneKeyConfigured={phoneKeyConfigured}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </>
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
          { id: 'subadmins', label: 'Subadmins' },
          { id: 'roles', label: 'Roles' },
          { id: 'permissions', label: 'Permission catalogue' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'admins' && <AdminsTab />}
      {tab === 'subadmins' && <SubadminsTab />}
      {tab === 'roles' && <RolesTab />}
      {tab === 'permissions' && <PermissionsTab />}
    </>
  );
}
