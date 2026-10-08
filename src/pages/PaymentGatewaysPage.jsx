import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CreditCard } from 'lucide-react';
import { paymentGatewaysApi } from '../api/endpoints';
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

function GatewayEditModal({ open, onClose, gateway }) {
  const [form, setForm] = useState(
    gateway
      ? {
          label: gateway.label || '',
          description: gateway.description || '',
          sortOrder: gateway.sortOrder ?? 0,
          enabled: gateway.enabled ?? true,
        }
      : { label: '', description: '', sortOrder: 0, enabled: true },
  );
  const [imageUrl, setImageUrl] = useState(gateway?.imageUrl || null);
  const [imageError, setImageError] = useState('');

  const mutation = useApiMutation({
    mutationFn: (body) => paymentGatewaysApi.update(gateway.id, body),
    successMessage: 'Gateway updated',
    invalidate: [qk.paymentGateways],
    onSuccess: onClose,
  });

  const uploadMutation = useApiMutation({
    mutationFn: (file) => {
      const fd = new FormData();
      fd.append('file', file);
      return paymentGatewaysApi.uploadImage(gateway.id, fd);
    },
    successMessage: 'Image uploaded',
    invalidate: [qk.paymentGateways],
    onSuccess: (data) => {
      setImageUrl(data?.imageUrl || null);
      setImageError('');
    },
  });

  const clearMutation = useApiMutation({
    mutationFn: () => paymentGatewaysApi.clearImage(gateway.id),
    successMessage: 'Image removed',
    invalidate: [qk.paymentGateways],
    onSuccess: () => setImageUrl(null),
  });

  const submit = () =>
    mutation.mutate({
      label: form.label.trim(),
      description: form.description.trim() || null,
      sortOrder: Number(form.sortOrder) || 0,
      enabled: form.enabled,
    });

  const onPickImage = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type);
    if (!ok) {
      setImageError('Only JPEG, PNG, WebP or GIF images are allowed');
      return;
    }
    setImageError('');
    uploadMutation.mutate(file);
  };

  const fieldErrors = mutation.error?.fieldErrors || {};

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit ${gateway?.label || gateway?.code || 'gateway'}`}
      description="Label, description and image are shown to the app when listing payment methods. Disable a gateway to hide it from create-order."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            loading={mutation.isPending}
            disabled={!form.label.trim()}
          >
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {mutation.error && <ErrorState error={mutation.error} compact />}

        <Field label="Code">
          <Input value={gateway?.code || ''} disabled />
        </Field>

        <Field label="Label" required error={fieldErrors.label}>
          <Input
            autoFocus
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder="Cashfree"
          />
        </Field>

        <Field label="Description" error={fieldErrors.description}>
          <Input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Pay with UPI, cards, and wallets"
          />
        </Field>

        <Field label="Sort order" hint="Lower shows first." error={fieldErrors.sortOrder}>
          <Input
            type="number"
            value={form.sortOrder}
            onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
          />
        </Field>

        <Field
          label="Image"
          hint="JPEG, PNG, WebP or GIF (max 5 MB). Shown next to the gateway in the app."
          error={imageError || uploadMutation.error?.message}
        >
          <div className="flex items-start gap-3">
            <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-ink-50 ring-1 ring-ink-200">
              {imageUrl ? (
                <img src={imageUrl} alt="" className="size-12 object-contain" />
              ) : (
                <CreditCard className="size-5 text-ink-300" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={onPickImage}
                disabled={uploadMutation.isPending}
                className="block w-full text-xs text-ink-600 file:mr-3 file:rounded-md file:border-0 file:bg-ink-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink-800 hover:file:bg-ink-200"
              />
              {imageUrl && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:bg-red-50"
                  loading={clearMutation.isPending}
                  onClick={() => clearMutation.mutate()}
                >
                  Remove image
                </Button>
              )}
            </div>
          </div>
        </Field>

        <div className="rounded-lg bg-ink-50 px-3.5 py-3">
          <Toggle
            checked={form.enabled}
            onChange={(v) => setForm({ ...form, enabled: v })}
            label="Enabled (shown in the app)"
          />
          {!form.enabled && (
            <p className="mt-2 text-xs text-ink-600">
              Disabled gateways are hidden from GET /payments/gateways and rejected on
              create-order.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function PaymentGatewaysPage() {
  const [editing, setEditing] = useState(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.paymentGateways,
    queryFn: () => paymentGatewaysApi.list(),
  });

  const toggleEnabled = useApiMutation({
    mutationFn: ({ id, enabled }) => paymentGatewaysApi.update(id, { enabled }),
    successMessage: (_d, vars) => (vars.enabled ? 'Gateway enabled' : 'Gateway disabled'),
    invalidate: [qk.paymentGateways],
  });

  const rows = data?.data || data || [];

  const columns = [
    {
      key: 'image',
      header: '',
      render: (row) => (
        <div className="flex size-9 items-center justify-center overflow-hidden rounded-lg bg-ink-50 ring-1 ring-ink-200">
          {row.imageUrl ? (
            <img src={row.imageUrl} alt="" className="size-7 object-contain" />
          ) : (
            <CreditCard className="size-4 text-ink-300" />
          )}
        </div>
      ),
    },
    {
      key: 'label',
      header: 'Gateway',
      render: (row) => (
        <div>
          <p className="font-medium text-ink-900">{row.label}</p>
          <p className="text-xs text-ink-500">{row.code}</p>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => (
        <span className="text-sm text-ink-600">{row.description || '—'}</span>
      ),
    },
    {
      key: 'enabled',
      header: 'Enabled',
      render: (row) => (
        <Toggle
          checked={row.enabled}
          disabled={toggleEnabled.isPending}
          onChange={(next) => toggleEnabled.mutate({ id: row.id, enabled: next })}
        />
      ),
    },
    {
      key: 'sortOrder',
      header: 'Order',
      align: 'right',
      render: (row) => row.sortOrder ?? 0,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge tone={row.enabled ? 'success' : 'neutral'}>
          {row.enabled ? 'Live' : 'Off'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <Button size="sm" variant="ghost" onClick={() => setEditing(row)}>
          Edit
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Payment gateways"
        description="Toggle Cashfree and PayGlocal, edit the labels the app shows, and upload gateway images."
      />

      {error && <ErrorState error={error} onRetry={refetch} />}

      <Card className="overflow-hidden p-0">
        <DataTable
          columns={columns}
          rows={rows}
          loading={isLoading}
          emptyTitle="No payment gateways"
          emptyDescription="Run the backend seed to create Cashfree and PayGlocal rows."
        />
      </Card>

      {editing && (
        <GatewayEditModal
          key={editing.id}
          open
          gateway={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
