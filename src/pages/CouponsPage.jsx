import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';
import { couponsApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { useApiMutation } from '../hooks/useApiMutation';
import { DataTable, Pagination } from '../components/DataTable';
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
  Textarea,
  Toggle,
} from '../components/ui';
import { useTableState } from '../hooks/useTableState';
import { fmtTokens } from '../lib/format';
import { useAuth } from '../auth/AuthContext';
import { P } from '../auth/permissions';

function CouponFormModal({ open, onClose, coupon }) {
  const editing = Boolean(coupon);
  const [form, setForm] = useState(() =>
    coupon
      ? {
          code: coupon.code || '',
          tokenAmount: coupon.tokenAmount ?? 100,
          validFrom: coupon.validFrom ? String(coupon.validFrom).slice(0, 16) : '',
          validTo: coupon.validTo ? String(coupon.validTo).slice(0, 16) : '',
          audience: coupon.audience || 'ANY',
          maxRedemptionsTotal:
            coupon.maxRedemptionsTotal == null ? '' : String(coupon.maxRedemptionsTotal),
          maxRedemptionsPerUser:
            coupon.maxRedemptionsPerUser == null ? '' : String(coupon.maxRedemptionsPerUser ?? 1),
          active: coupon.active !== false,
          note: coupon.note || '',
          allowedUserIds: (coupon.allowedUserIds || []).join('\n'),
        }
      : {
          code: '',
          tokenAmount: 100,
          validFrom: '',
          validTo: '',
          audience: 'ANY',
          maxRedemptionsTotal: '',
          maxRedemptionsPerUser: '1',
          active: true,
          note: '',
          allowedUserIds: '',
        },
  );

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const mutation = useApiMutation({
    mutationFn: () => {
      const body = {
        code: form.code,
        tokenAmount: Number(form.tokenAmount),
        validFrom: form.validFrom ? new Date(form.validFrom).toISOString() : null,
        validTo: form.validTo ? new Date(form.validTo).toISOString() : null,
        audience: form.audience,
        maxRedemptionsTotal:
          form.maxRedemptionsTotal === '' ? null : Number(form.maxRedemptionsTotal),
        maxRedemptionsPerUser:
          form.maxRedemptionsPerUser === '' ? null : Number(form.maxRedemptionsPerUser),
        active: form.active,
        note: form.note || null,
        allowedUserIds:
          form.audience === 'SPECIFIC_USERS'
            ? form.allowedUserIds
                .split(/[\s,]+/)
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
      };
      return editing ? couponsApi.update(coupon.id, body) : couponsApi.create(body);
    },
    successMessage: editing ? 'Coupon updated' : 'Coupon created',
    invalidate: [['coupons']],
    onSuccess: onClose,
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit coupon' : 'Create coupon'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={mutation.isPending} onClick={() => mutation.mutate()}>
            {editing ? 'Save' : 'Create'}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Code*" className="sm:col-span-2">
          <Input
            value={form.code}
            onChange={(e) => set('code', e.target.value.toUpperCase())}
            placeholder="WELCOME100"
            disabled={editing}
          />
        </Field>
        <Field label="Tokens*">
          <Input
            type="number"
            min={1}
            value={form.tokenAmount}
            onChange={(e) => set('tokenAmount', e.target.value)}
          />
        </Field>
        <Field label="Per-user limit (blank = unlimited)">
          <Input
            type="number"
            min={1}
            value={form.maxRedemptionsPerUser}
            onChange={(e) => set('maxRedemptionsPerUser', e.target.value)}
            placeholder="1"
          />
        </Field>
        <Field label="Global limit (blank = unlimited)">
          <Input
            type="number"
            min={1}
            value={form.maxRedemptionsTotal}
            onChange={(e) => set('maxRedemptionsTotal', e.target.value)}
          />
        </Field>
        <Field label="Audience">
          <Select value={form.audience} onChange={(e) => set('audience', e.target.value)}>
            <option value="ANY">Any user</option>
            <option value="SPECIFIC_USERS">Specific users</option>
          </Select>
        </Field>
        <Field label="Valid from (optional)">
          <Input
            type="datetime-local"
            value={form.validFrom}
            onChange={(e) => set('validFrom', e.target.value)}
          />
        </Field>
        <Field label="Valid to (optional)">
          <Input
            type="datetime-local"
            value={form.validTo}
            onChange={(e) => set('validTo', e.target.value)}
          />
        </Field>
        <Field label="Active" className="sm:col-span-2">
          <Toggle checked={form.active} onChange={(v) => set('active', v)} />
        </Field>
        {form.audience === 'SPECIFIC_USERS' ? (
          <Field label="Allowed user IDs (one per line)*" className="sm:col-span-2">
            <Textarea
              rows={4}
              value={form.allowedUserIds}
              onChange={(e) => set('allowedUserIds', e.target.value)}
              placeholder="uuid…"
            />
          </Field>
        ) : null}
        <Field label="Note" className="sm:col-span-2">
          <Input value={form.note} onChange={(e) => set('note', e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

export function CouponsPage() {
  const { can } = useAuth();
  const writable = can(P.COUPONS_WRITE);
  const table = useTableState({ search: '' }, { limit: 20 });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [usageCouponId, setUsageCouponId] = useState(null);

  const listQuery = useQuery({
    queryKey: qk.coupons(table.params),
    queryFn: () => couponsApi.list(table.params),
  });

  const redemptionsQuery = useQuery({
    queryKey: qk.couponRedemptions({ couponId: usageCouponId, page: 1, limit: 50 }),
    queryFn: () =>
      couponsApi.redemptions({ couponId: usageCouponId, page: 1, limit: 50 }),
    enabled: Boolean(usageCouponId),
  });

  const columns = useMemo(
    () => [
      {
        key: 'code',
        header: 'Code',
        render: (row) => <span className="font-mono text-sm font-medium">{row.code}</span>,
      },
      {
        key: 'tokens',
        header: 'Tokens',
        align: 'right',
        render: (row) => fmtTokens(row.tokenAmount),
      },
      {
        key: 'audience',
        header: 'Audience',
        render: (row) => (
          <Badge tone={row.audience === 'ANY' ? 'info' : 'warning'}>
            {row.audience === 'ANY' ? 'any user' : 'specific users'}
          </Badge>
        ),
      },
      {
        key: 'limits',
        header: 'Limits',
        render: (row) => (
          <span className="text-xs text-ink-600">
            per user: {row.maxRedemptionsPerUser ?? '∞'} · global:{' '}
            {row.maxRedemptionsTotal ?? '∞'} · used: {row.redemptionCount ?? 0}
          </span>
        ),
      },
      {
        key: 'validity',
        header: 'Validity (IST)',
        render: (row) => (
          <span className="text-xs text-ink-600">
            {row.validFromIst || '—'} → {row.validToIst || '—'}
          </span>
        ),
      },
      {
        key: 'active',
        header: 'Active',
        render: (row) => (
          <Badge tone={row.active ? 'success' : 'neutral'}>{row.active ? 'yes' : 'no'}</Badge>
        ),
      },
      {
        key: 'actions',
        header: '',
        render: (row) => (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setUsageCouponId(row.id)}>
              Usage
            </Button>
            {writable ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setEditing(row);
                  setFormOpen(true);
                }}
              >
                Edit
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    [writable],
  );

  const usageColumns = [
    {
      key: 'user',
      header: 'User',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm">{row.user?.name || row.userId}</p>
          <p className="font-mono text-[11px] text-ink-500">
            {row.user?.countryCode}
            {row.user?.mobileNumber}
          </p>
        </div>
      ),
    },
    {
      key: 'tokens',
      header: 'Tokens',
      align: 'right',
      render: (row) => fmtTokens(row.tokensCredited),
    },
    {
      key: 'when',
      header: 'Redeemed (IST)',
      render: (row) => <span className="text-xs">{row.redeemedAtIst || '—'}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Coupons"
        description="Fixed-token redeem codes. Per-user limit defaults to 1; validity and audience are configurable. Does not change payments or call billing."
        actions={
          <>
            <Button variant="secondary" onClick={() => listQuery.refetch()} loading={listQuery.isFetching}>
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            {writable ? (
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="size-4" />
                Create coupon
              </Button>
            ) : null}
          </>
        }
      />

      <Card>
        <div className="mb-3 flex flex-wrap gap-2">
          <Input
            className="max-w-xs"
            placeholder="Search code…"
            value={table.filters.search || ''}
            onChange={(e) => table.setFilter('search', e.target.value)}
          />
        </div>
        {listQuery.isError ? (
          <ErrorState error={listQuery.error} onRetry={() => listQuery.refetch()} />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={listQuery.data?.data || []}
              loading={listQuery.isLoading}
              emptyTitle="No coupons yet"
            />
            <Pagination
              meta={listQuery.data?.meta}
              onPageChange={table.setPage}
              onLimitChange={table.changeLimit}
            />
          </>
        )}
      </Card>

      <Modal
        open={Boolean(usageCouponId)}
        onClose={() => setUsageCouponId(null)}
        title="Coupon usage (IST)"
        size="lg"
      >
        {redemptionsQuery.isError ? (
          <ErrorState error={redemptionsQuery.error} />
        ) : (
          <DataTable
            columns={usageColumns}
            rows={redemptionsQuery.data?.data || []}
            loading={redemptionsQuery.isLoading}
            emptyTitle="No redemptions yet"
          />
        )}
      </Modal>

      {formOpen ? (
        <CouponFormModal
          key={editing?.id || 'new'}
          open={formOpen}
          coupon={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}
