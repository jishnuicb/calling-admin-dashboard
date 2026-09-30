import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldBan, Unlock } from 'lucide-react';
import { securityApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
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
  StatusBadge,
} from '../components/ui';
import { useApiMutation } from '../hooks/useApiMutation';
import { useTableState } from '../hooks/useTableState';
import { useAuth } from '../auth/AuthContext';
import { P } from '../auth/permissions';
import { fmtDateTime } from '../lib/format';

function BlockIpModal({ onClose }) {
  const [ip, setIp] = useState('');
  const [detail, setDetail] = useState('');
  const [ttlSeconds, setTtlSeconds] = useState('0');

  const mutation = useApiMutation({
    mutationFn: () =>
      securityApi.blockIp({
        ip: ip.trim(),
        reason: 'MANUAL',
        detail: detail.trim() || undefined,
        ttlSeconds: Number(ttlSeconds) || 0,
      }),
    successMessage: 'IP blocked',
    invalidate: [['security', 'ip-blocks']],
    onSuccess: onClose,
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Block IP"
      description="Manual block. Use TTL 0 to keep blocked until an admin unblocks."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!ip.trim()}
          >
            Block
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {mutation.error && <ErrorState error={mutation.error} compact />}
        <Field label="IP address">
          <Input
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            placeholder="1.2.3.4"
            className="font-mono text-sm"
          />
        </Field>
        <Field label="Note (optional)">
          <Input value={detail} onChange={(e) => setDetail(e.target.value)} />
        </Field>
        <Field label="TTL seconds (0 = until unblock)">
          <Input
            type="number"
            min={0}
            value={ttlSeconds}
            onChange={(e) => setTtlSeconds(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

export function IpBlocksPage() {
  const { can } = useAuth();
  const canWrite = can(P.SECURITY_WRITE);
  const [blockOpen, setBlockOpen] = useState(false);

  const table = useTableState({
    status: 'active',
    reason: '',
    search: '',
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.ipBlocks(table.params),
    queryFn: () => securityApi.listIpBlocks(table.params),
  });

  const unblock = useApiMutation({
    mutationFn: (id) => securityApi.unblockIp(id),
    successMessage: 'IP unblocked',
    invalidate: [['security', 'ip-blocks']],
  });

  const columns = [
    {
      key: 'ip',
      header: 'IP',
      render: (row) => <span className="font-mono text-sm font-medium">{row.ip}</span>,
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (row) => <Badge>{row.reason}</Badge>,
    },
    {
      key: 'source',
      header: 'Source',
      render: (row) => row.source,
    },
    {
      key: 'detail',
      header: 'Detail',
      render: (row) => (
        <span className="line-clamp-2 max-w-xs text-xs text-ink-600">{row.detail || '—'}</span>
      ),
    },
    {
      key: 'stats',
      header: 'Counts',
      render: (row) => (
        <span className="text-xs text-ink-600">
          req {row.requestCount ?? '—'} · mobiles {row.uniqueMobiles ?? '—'}
        </span>
      ),
    },
    {
      key: 'active',
      header: 'Status',
      render: (row) => (
        <StatusBadge status={row.active ? 'ACTIVE' : 'INACTIVE'} />
      ),
    },
    {
      key: 'blockedAt',
      header: 'Blocked',
      render: (row) => (
        <span className="text-xs text-ink-600">{fmtDateTime(row.blockedAt)}</span>
      ),
    },
    {
      key: 'expiresAt',
      header: 'Expires',
      render: (row) => (
        <span className="text-xs text-ink-600">
          {row.expiresAt ? fmtDateTime(row.expiresAt) : 'Until unblock'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) =>
        canWrite && row.active ? (
          <Button
            size="sm"
            variant="secondary"
            loading={unblock.isPending}
            onClick={() => unblock.mutate(row.id)}
          >
            <Unlock className="size-3.5" />
            Unblock
          </Button>
        ) : null,
    },
  ];

  const settings = data?.settings;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Blocked IPs"
        description="Auto-blocks from per-IP rate limits and OTP abuse, plus manual blocks. Unblock restores access immediately."
        actions={
          canWrite ? (
            <Button onClick={() => setBlockOpen(true)}>
              <ShieldBan className="size-4" />
              Block IP
            </Button>
          ) : null
        }
      />

      {settings && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-ink-500">Enabled</p>
            <p className="mt-1 font-semibold">{settings.enabled ? 'Yes' : 'No'}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-ink-500">API rate</p>
            <p className="mt-1 font-semibold">
              {settings.rateLimitMax} / {Math.round(settings.rateLimitWindowMs / 1000)}s
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-ink-500">OTP / IP</p>
            <p className="mt-1 font-semibold">
              {settings.otpIpMax} sends · {settings.otpUniqueMobilesMax} mobiles
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-ink-500">Auto-ban TTL</p>
            <p className="mt-1 font-semibold">
              {settings.banTtlSeconds ? `${settings.banTtlSeconds}s` : 'Until unblock'}
            </p>
          </Card>
        </div>
      )}

      <Card>
        <FilterBar>
          <Field label="Status">
            <Select
              value={table.filters.status}
              onChange={(e) => table.setFilter('status', e.target.value)}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </Select>
          </Field>
          <Field label="Reason">
            <Select
              value={table.filters.reason}
              onChange={(e) => table.setFilter('reason', e.target.value)}
            >
              <option value="">All</option>
              <option value="RATE_LIMIT">RATE_LIMIT</option>
              <option value="OTP_ABUSE">OTP_ABUSE</option>
              <option value="OTP_SPRAY">OTP_SPRAY</option>
              <option value="MANUAL">MANUAL</option>
            </Select>
          </Field>
          <Field label="Search IP">
            <Input
              value={table.filters.search}
              onChange={(e) => table.setFilter('search', e.target.value)}
              placeholder="1.2.3"
              className="font-mono text-xs"
            />
          </Field>
        </FilterBar>

        <DataTable
          columns={columns}
          rows={data?.data || []}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          emptyTitle="No blocked IPs"
          emptyDescription="IPs appear here after auto rate-limit / OTP abuse blocks, or when you block manually."
        />
        <Pagination meta={data?.meta} page={table.page} onPageChange={table.setPage} />
      </Card>

      {blockOpen && <BlockIpModal onClose={() => setBlockOpen(false)} />}
    </div>
  );
}
