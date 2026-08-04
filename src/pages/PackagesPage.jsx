import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package, Plus, Trash2 } from 'lucide-react';
import { packagesApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { useApiMutation } from '../hooks/useApiMutation';
import { DataTable } from '../components/DataTable';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  Modal,
  PageHeader,
  Toggle,
} from '../components/ui';
import { fmtMoney, fmtTokens } from '../lib/format';

function PackageFormModal({ open, onClose, pkg }) {
  const editing = Boolean(pkg);
  const [form, setForm] = useState(
    pkg
      ? {
          name: pkg.name || '',
          tokens: pkg.tokens ?? '',
          bonusTokens: pkg.bonusTokens ?? 0,
          price: pkg.price ?? '',
          originalPrice: pkg.originalPrice ?? '',
          discountPercent: pkg.discountPercent ?? 0,
          currency: pkg.currency || 'INR',
          active: pkg.active ?? true,
          sortOrder: pkg.sortOrder ?? 0,
        }
      : {
          name: '',
          tokens: '',
          bonusTokens: 0,
          price: '',
          originalPrice: '',
          discountPercent: 0,
          currency: 'INR',
          active: true,
          sortOrder: 0,
        },
  );

  const mutation = useApiMutation({
    mutationFn: (body) => (editing ? packagesApi.update(pkg.id, body) : packagesApi.create(body)),
    successMessage: editing ? 'Package updated' : 'Package created',
    invalidate: [qk.packages],
    onSuccess: onClose,
  });

  const submit = () => {
    const body = {
      name: form.name.trim(),
      tokens: Number(form.tokens),
      bonusTokens: Number(form.bonusTokens) || 0,
      price: Number(form.price),
      originalPrice: form.originalPrice === '' || form.originalPrice == null
        ? null
        : Number(form.originalPrice),
      active: form.active,
      sortOrder: Number(form.sortOrder) || 0,
    };
    // `currency` is only accepted on create.
    if (!editing) body.currency = form.currency;
    mutation.mutate(body);
  };

  const fieldErrors = mutation.error?.fieldErrors || {};
  const totalTokens = (Number(form.tokens) || 0) + (Number(form.bonusTokens) || 0);
  const perToken = totalTokens > 0 ? (Number(form.price) || 0) / totalTokens : 0;
  const sell = Number(form.price) || 0;
  const original = Number(form.originalPrice) || 0;
  const computedDiscount =
    original > sell && sell > 0 ? Math.round(((original - sell) / original) * 100) : 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${pkg.name}` : 'Create a token package'}
      description="Packages are what the app shows on its recharge screen. Prices are snapshotted onto each order, so edits never rewrite past payments."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            loading={mutation.isPending}
            disabled={!form.name.trim() || !form.tokens || !form.price}
          >
            {editing ? 'Save changes' : 'Create package'}
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
            placeholder="Starter Pack"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Tokens" required error={fieldErrors.tokens}>
            <Input
              type="number"
              min="1"
              value={form.tokens}
              onChange={(e) => setForm({ ...form, tokens: e.target.value })}
            />
          </Field>
          <Field label="Bonus tokens" error={fieldErrors.bonusTokens}>
            <Input
              type="number"
              min="0"
              value={form.bonusTokens}
              onChange={(e) => setForm({ ...form, bonusTokens: e.target.value })}
            />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field
            label="Sale price"
            required
            error={fieldErrors.price}
            className="col-span-2"
            hint="Amount charged at checkout."
          >
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </Field>
          <Field label="Currency" error={fieldErrors.currency}>
            <Input
              value={form.currency}
              disabled={editing}
              maxLength={3}
              onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Original price (MRP)"
            hint="Optional. When higher than sale price, the app shows a discount."
            error={fieldErrors.originalPrice}
          >
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.originalPrice}
              onChange={(e) => setForm({ ...form, originalPrice: e.target.value })}
              placeholder="Leave blank for no discount"
            />
          </Field>
          <Field label="Discount" hint="Derived from original vs sale price.">
            <Input value={computedDiscount ? `${computedDiscount}% off` : 'No discount'} disabled />
          </Field>
        </div>

        {totalTokens > 0 && Number(form.price) > 0 && (
          <div className="rounded-lg bg-ink-50 px-3.5 py-2.5 text-xs text-ink-600">
            {fmtTokens(totalTokens)} tokens for {fmtMoney(Number(form.price), form.currency)}
            {computedDiscount > 0 && (
              <>
                {' '}
                <span className="text-ink-400 line-through">
                  {fmtMoney(original, form.currency)}
                </span>{' '}
                <span className="font-medium text-emerald-700">{computedDiscount}% off</span>
              </>
            )}{' '}
            —{' '}
            <span className="font-medium text-ink-800">
              {fmtMoney(perToken, form.currency)} per token
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 items-end gap-4">
          <Field label="Sort order" hint="Lower shows first.">
            <Input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
            />
          </Field>
          <Toggle
            checked={form.active}
            onChange={(v) => setForm({ ...form, active: v })}
            label="Available for purchase"
          />
        </div>
      </div>
    </Modal>
  );
}

export function PackagesPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.packages,
    queryFn: () => packagesApi.list(),
  });

  const toggleActive = useApiMutation({
    mutationFn: ({ id, active }) => packagesApi.update(id, { active }),
    successMessage: (_d, vars) => (vars.active ? 'Package activated' : 'Package deactivated'),
    invalidate: [qk.packages],
  });

  const remove = useApiMutation({
    mutationFn: (id) => packagesApi.remove(id),
    successMessage: 'Package removed',
    invalidate: [qk.packages],
    onSuccess: () => setDeleting(null),
  });

  const rows = data?.data || data || [];

  const columns = [
    {
      key: 'name',
      header: 'Package',
      render: (row) => <span className="font-medium text-ink-900">{row.name}</span>,
    },
    {
      key: 'tokens',
      header: 'Tokens',
      align: 'right',
      render: (row) => (
        <div>
          <p className="font-medium text-ink-800">{fmtTokens(row.tokens)}</p>
          {row.bonusTokens > 0 && (
            <p className="text-[11px] text-emerald-600">+{fmtTokens(row.bonusTokens)} bonus</p>
          )}
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      align: 'right',
      render: (row) => (
        <div className="text-right">
          <p className="font-medium text-ink-800">{fmtMoney(row.price, row.currency)}</p>
          {row.discountPercent > 0 && row.originalPrice != null && (
            <p className="text-[11px] text-ink-400">
              <span className="line-through">{fmtMoney(row.originalPrice, row.currency)}</span>
              {' · '}
              <span className="text-emerald-600">{row.discountPercent}% off</span>
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'perToken',
      header: 'Per token',
      align: 'right',
      render: (row) => {
        const total = (row.tokens || 0) + (row.bonusTokens || 0);
        return total > 0 ? (
          <span className="text-xs text-ink-600">
            {fmtMoney((row.price || 0) / total, row.currency)}
          </span>
        ) : (
          '—'
        );
      },
    },
    {
      key: 'active',
      header: 'Available',
      render: (row) => (
        <Toggle
          checked={row.active}
          disabled={toggleActive.isPending}
          onChange={(next) => toggleActive.mutate({ id: row.id, active: next })}
        />
      ),
    },
    { key: 'sortOrder', header: 'Order', align: 'right', render: (row) => row.sortOrder ?? 0 },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
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
            onClick={() => setDeleting(row)}
            aria-label={`Delete ${row.name}`}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Token packages"
        description="What callers can buy. Deactivate rather than delete to keep a package out of the app while preserving its purchase history."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" />
            New package
          </Button>
        }
      />

      <Card bodyClassName="">
        <DataTable
          columns={columns}
          rows={rows}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          emptyIcon={Package}
          emptyTitle="No token packages yet"
          emptyDescription="Run the backend seed, or create one now."
          emptyAction={
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" />
              New package
            </Button>
          }
        />
      </Card>

      {formOpen && (
        <PackageFormModal
          open
          pkg={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      )}

      {deleting && (
        <Modal
          open
          onClose={() => setDeleting(null)}
          title={`Delete ${deleting.name}?`}
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
                Delete package
              </Button>
            </>
          }
        >
          {remove.error && <ErrorState error={remove.error} compact />}
          <p className="text-sm text-ink-600">
            If this package has been purchased, the API will refuse the delete to preserve payment
            history. Deactivate it instead — it disappears from the app either way.
          </p>
          {deleting.active && (
            <div className="mt-3">
              <Badge tone="warning">Currently available for purchase</Badge>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
