import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Languages, Plus, Trash2 } from 'lucide-react';
import { languagesApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { useApiMutation } from '../hooks/useApiMutation';
import { useAuth } from '../auth/AuthContext';
import { P } from '../auth/permissions';
import { DataTable, FilterBar } from '../components/DataTable';
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
import { fmtDateTime, fmtNumber } from '../lib/format';

function LanguageFormModal({ open, onClose, language }) {
  const editing = Boolean(language);
  const [form, setForm] = useState(
    language
      ? {
          name: language.name || '',
          code: language.code || '',
          active: language.active ?? true,
          sortOrder: language.sortOrder ?? 0,
        }
      : { name: '', code: '', active: true, sortOrder: 0 },
  );

  const mutation = useApiMutation({
    mutationFn: (body) =>
      editing ? languagesApi.update(language.id, body) : languagesApi.create(body),
    successMessage: editing ? 'Language updated' : 'Language created',
    invalidate: [['languages'], ['dashboard']],
    onSuccess: onClose,
  });

  const submit = () =>
    mutation.mutate({
      name: form.name.trim(),
      code: form.code.trim() || undefined,
      active: form.active,
      sortOrder: Number(form.sortOrder) || 0,
    });

  const fieldErrors = mutation.error?.fieldErrors || {};

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${language.name}` : 'Add a language'}
      description="The master list is the single source of truth for which languages listeners can select and callers can filter by."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={mutation.isPending} disabled={!form.name.trim()}>
            {editing ? 'Save changes' : 'Create language'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {mutation.error && <ErrorState error={mutation.error} compact />}

        <Field label="Name" required error={fieldErrors.name}>
          <Input
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Marathi"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Code"
            hint="ISO 639-1 where one applies."
            error={fieldErrors.code}
          >
            <Input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="mr"
              maxLength={10}
            />
          </Field>
          <Field label="Sort order" hint="Lower shows first." error={fieldErrors.sortOrder}>
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
            label="Active (selectable and filterable)"
          />
          {!form.active && (
            <p className="mt-2 text-xs text-ink-600">
              Deactivating hides this language from the apply screen and the discovery filter.
              Listeners who already selected it keep their mapping, so history and reporting stay
              intact.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}

/**
 * Hard delete. The API refuses with 409 LANGUAGE_IN_USE while any listener
 * references the language, and a Restrict foreign key backs that up at the
 * database level. We surface the listener count up front so the admin knows
 * before clicking, then offer deactivation as the correct alternative.
 */
function DeleteLanguageModal({ language, onClose }) {
  const inUse = (language.listenerCount ?? 0) > 0;

  const deleteMutation = useApiMutation({
    mutationFn: () => languagesApi.remove(language.id),
    successMessage: `${language.name} deleted`,
    invalidate: [['languages'], ['dashboard']],
    onSuccess: onClose,
  });

  const deactivateMutation = useApiMutation({
    mutationFn: () => languagesApi.update(language.id, { active: false }),
    successMessage: `${language.name} deactivated`,
    invalidate: [['languages'], ['dashboard']],
    onSuccess: onClose,
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Delete ${language.name}?`}
      description="Hard delete is only permitted while no listener references the language."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {inUse ? (
            language.active && (
              <Button
                variant="danger"
                onClick={() => deactivateMutation.mutate()}
                loading={deactivateMutation.isPending}
              >
                Deactivate instead
              </Button>
            )
          ) : (
            <Button
              variant="danger"
              onClick={() => deleteMutation.mutate()}
              loading={deleteMutation.isPending}
            >
              Delete permanently
            </Button>
          )}
        </>
      }
    >
      {(deleteMutation.error || deactivateMutation.error) && (
        <ErrorState error={deleteMutation.error || deactivateMutation.error} compact />
      )}

      {inUse ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3">
            <p className="text-sm font-medium text-amber-900">
              {fmtNumber(language.listenerCount)} listener(s) have selected this language.
            </p>
            <p className="mt-1.5 text-xs text-amber-800">
              Deleting would orphan their history, so the API returns a 409. Deactivate it instead:
              it disappears from the apply screen and the discovery filter, while existing mappings
              are preserved for reporting.
            </p>
          </div>
          {!language.active && (
            <p className="text-xs text-ink-500">This language is already deactivated.</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-ink-600">
          No listener references this language, so it can be safely removed. This cannot be undone.
        </p>
      )}
    </Modal>
  );
}

export function LanguagesPage() {
  const { can } = useAuth();
  const [filters, setFilters] = useState({ active: '', search: '' });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const params = {
    ...(filters.active === '' ? {} : { active: filters.active }),
    ...(filters.search ? { search: filters.search } : {}),
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.languages(params),
    queryFn: () => languagesApi.list(params),
  });

  const toggleActive = useApiMutation({
    mutationFn: ({ id, active }) => languagesApi.update(id, { active }),
    successMessage: (_data, vars) => (vars.active ? 'Language activated' : 'Language deactivated'),
    invalidate: [['languages'], ['dashboard']],
  });

  const rows = data?.data || [];
  const writable = can(P.LANGUAGES_WRITE);

  const columns = [
    {
      key: 'name',
      header: 'Language',
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-ink-900">{row.name}</span>
          {row.code && (
            <span className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-[11px] text-ink-600">
              {row.code}
            </span>
          )}
        </div>
      ),
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
      key: 'listenerCount',
      header: 'Listeners',
      align: 'right',
      render: (row) => (
        <span className={row.listenerCount > 0 ? 'font-medium text-ink-800' : 'text-ink-400'}>
          {fmtNumber(row.listenerCount ?? 0)}
        </span>
      ),
    },
    { key: 'sortOrder', header: 'Order', align: 'right', render: (row) => row.sortOrder ?? 0 },
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
            {can(P.LANGUAGES_DELETE) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleting(row);
                }}
                className="text-red-600 hover:bg-red-50"
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
      <PageHeader
        title="Language master"
        description="Admin-managed list, not a hardcoded enum — a new regional language can be added without a deployment."
        actions={
          writable && (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" />
              Add language
            </Button>
          )
        }
      />

      <Card bodyClassName="">
        <FilterBar
          onReset={
            filters.active || filters.search ? () => setFilters({ active: '', search: '' }) : undefined
          }
        >
          <Field label="Search" className="w-full sm:w-56">
            <SearchInput
              value={filters.search}
              onChange={(v) => setFilters({ ...filters, search: v })}
              placeholder="Language name"
            />
          </Field>
          <Field label="State" className="w-40">
            <Select
              value={filters.active}
              onChange={(e) => setFilters({ ...filters, active: e.target.value })}
            >
              <option value="">All</option>
              <option value="true">Active only</option>
              <option value="false">Inactive only</option>
            </Select>
          </Field>
        </FilterBar>

        <DataTable
          columns={columns}
          rows={rows}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          emptyIcon={Languages}
          emptyTitle="No languages found"
          emptyDescription="Seed the default list or add one manually."
        />
      </Card>

      <p className="mt-3 text-xs text-ink-500">
        Deactivating removes a language from <code className="font-mono">GET /languages</code> and
        the discovery filter but preserves existing listener mappings. Hard delete is blocked while
        any listener still references it.
      </p>

      {formOpen && (
        <LanguageFormModal
          open
          language={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      )}
      {deleting && <DeleteLanguageModal language={deleting} onClose={() => setDeleting(null)} />}
    </>
  );
}
