import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { paymentsApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { DataTable, FilterBar, Pagination } from '../components/DataTable';
import { Card, Field, Input, PageHeader, SearchInput, Select } from '../components/ui';
import { useTableState } from '../hooks/useTableState';
import { fmtDateTime, shortId } from '../lib/format';

export function PaymentErrorsPage() {
  const navigate = useNavigate();
  const table = useTableState({
    code: '',
    gateway: '',
    source: '',
    transactionRef: '',
    from: '',
    to: '',
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.paymentErrors(table.params),
    queryFn: () => paymentsApi.errors(table.params),
  });

  const columns = [
    {
      key: 'when',
      header: 'When',
      render: (row) => <span className="text-xs text-ink-600">{fmtDateTime(row.createdAt)}</span>,
    },
    {
      key: 'code',
      header: 'Code',
      render: (row) => (
        <div className="min-w-0">
          <p className="text-sm font-medium text-rose-800">{row.code || '—'}</p>
          <p className="text-xs text-ink-600">{row.source}</p>
        </div>
      ),
    },
    {
      key: 'message',
      header: 'Message',
      render: (row) => (
        <p className="max-w-md whitespace-pre-wrap text-sm text-ink-800">{row.message}</p>
      ),
    },
    {
      key: 'payment',
      header: 'Payment',
      render: (row) =>
        row.paymentId ? (
          <Link
            to={`/payments/${row.paymentId}`}
            className="font-mono text-xs text-brand-600 hover:underline"
          >
            {row.transactionRef || shortId(row.paymentId)}
          </Link>
        ) : (
          <span className="font-mono text-xs text-ink-500">{row.transactionRef || '—'}</span>
        ),
    },
    {
      key: 'gateway',
      header: 'Gateway',
      render: (row) => row.gateway || '—',
    },
    {
      key: 'http',
      header: 'HTTP',
      align: 'right',
      render: (row) => row.httpStatus ?? '—',
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Payment errors"
        description="Separate error log for gateway/client/server payment failures, including response details. Existing payment list/detail APIs are unchanged."
      />

      <Card>
        <FilterBar>
          <SearchInput
            value={table.filters.transactionRef || ''}
            onChange={(v) => table.setFilter('transactionRef', v)}
            placeholder="Transaction ref"
          />
          <Field label="Code" className="w-44">
            <Input
              value={table.filters.code || ''}
              onChange={(e) => table.setFilter('code', e.target.value)}
              placeholder="ORDER_CREATE_FAILED"
            />
          </Field>
          <Field label="Gateway" className="w-40">
            <Select
              value={table.filters.gateway || ''}
              onChange={(e) => table.setFilter('gateway', e.target.value || undefined)}
            >
              <option value="">All</option>
              <option value="CASHFREE">CASHFREE</option>
              <option value="PAYGLOCAL">PAYGLOCAL</option>
              <option value="RAZORPAY">RAZORPAY</option>
              <option value="APPLE_IAP">APPLE_IAP</option>
            </Select>
          </Field>
          <Field label="Source" className="w-36">
            <Select
              value={table.filters.source || ''}
              onChange={(e) => table.setFilter('source', e.target.value || undefined)}
            >
              <option value="">All</option>
              <option value="SERVER">SERVER</option>
              <option value="CLIENT">CLIENT</option>
              <option value="GATEWAY">GATEWAY</option>
            </Select>
          </Field>
          <Field label="From" className="w-36">
            <Input
              type="date"
              value={table.filters.from || ''}
              onChange={(e) => table.setFilter('from', e.target.value)}
            />
          </Field>
          <Field label="To" className="w-36">
            <Input
              type="date"
              value={table.filters.to || ''}
              onChange={(e) => table.setFilter('to', e.target.value)}
            />
          </Field>
        </FilterBar>

        <DataTable
          columns={columns}
          rows={data?.data || []}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          emptyIcon={AlertTriangle}
          emptyTitle="No payment errors"
          emptyDescription="Failures from create-order, webhooks, and client SDK beacons appear here."
          onRowClick={(row) => {
            if (row.paymentId) navigate(`/payments/${row.paymentId}`);
          }}
        />
        <Pagination meta={data?.meta} onPageChange={table.setPage} onLimitChange={table.changeLimit} />
      </Card>
    </div>
  );
}
