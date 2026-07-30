import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, Download } from 'lucide-react';
import { paymentsApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { DataTable, FilterBar, Pagination } from '../components/DataTable';
import { Button, Card, Field, Input, PageHeader, SearchInput, Select, StatusBadge } from '../components/ui';
import { useToast } from '../components/ui/Toast';
import { useTableState } from '../hooks/useTableState';
import { fmtDateTime, fmtMoney, fmtTokens, shortId } from '../lib/format';

export function PaymentsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();

  const table = useTableState({
    status: searchParams.get('status') || '',
    search: '',
    userId: '',
    from: '',
    to: '',
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.payments(table.params),
    queryFn: () => paymentsApi.list(table.params),
  });

  const exportCsv = async () => {
    try {
      await paymentsApi.downloadReport({ from: table.filters.from, to: table.filters.to });
      toast.success('Payment report downloaded');
    } catch (err) {
      toast.error(err);
    }
  };

  const columns = [
    {
      key: 'ref',
      header: 'Reference',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-mono text-xs font-medium text-ink-900">
            {row.transactionRef}
          </p>
          <p className="truncate font-mono text-[11px] text-ink-500" title={row.cfOrderId}>
            {row.cfOrderId ? `CF ${shortId(row.cfOrderId)}` : 'no Cashfree order yet'}
          </p>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (row) => (
        <div>
          <p className="font-medium text-ink-900">{fmtMoney(row.amount, row.currency)}</p>
          {row.refundAmount > 0 && (
            <p className="text-[11px] text-amber-600">
              −{fmtMoney(row.refundAmount, row.currency)} refunded
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'tokens',
      header: 'Tokens',
      align: 'right',
      render: (row) => (
        <div>
          <p className="text-ink-800">{fmtTokens(row.tokens)}</p>
          {row.bonusTokens > 0 && (
            <p className="text-[11px] text-emerald-600">+{fmtTokens(row.bonusTokens)} bonus</p>
          )}
        </div>
      ),
    },
    {
      key: 'credited',
      header: 'Wallet',
      render: (row) =>
        row.walletCreditedAt ? (
          <span className="text-xs text-emerald-700" title={fmtDateTime(row.walletCreditedAt)}>
            Credited
          </span>
        ) : (
          <span className="text-xs text-ink-400">Not credited</span>
        ),
    },
    {
      key: 'user',
      header: 'User',
      render: (row) => (
        <span className="truncate text-xs text-ink-600">
          {row.user?.name || shortId(row.userId)}
        </span>
      ),
    },
    {
      key: 'method',
      header: 'Method',
      render: (row) => <span className="text-xs text-ink-600">{row.paymentMethod || '—'}</span>,
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (row) => <span className="text-xs text-ink-600">{fmtDateTime(row.createdAt)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Payments"
        description="Cashfree transactions. A wallet is credited only after a signature-verified webhook, so a payment without a credited timestamp never moved tokens."
        actions={
          <Button variant="secondary" onClick={exportCsv}>
            <Download className="size-4" />
            Export CSV
          </Button>
        }
      />

      <Card bodyClassName="">
        <FilterBar onReset={table.isFiltered ? table.reset : undefined}>
          <Field label="Search" className="w-full sm:w-56">
            <SearchInput
              value={table.filters.search}
              onChange={(v) => table.setFilter('search', v)}
              placeholder="Reference or Cashfree id"
            />
          </Field>

          <Field label="Status" className="w-44">
            <Select
              value={table.filters.status}
              onChange={(e) => table.setFilter('status', e.target.value)}
            >
              <option value="">All</option>
              {[
                'CREATED',
                'PENDING',
                'SUCCESS',
                'FAILED',
                'CANCELLED',
                'REFUND_PENDING',
                'REFUNDED',
                'PARTIALLY_REFUNDED',
              ].map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="User id" className="w-44">
            <SearchInput
              value={table.filters.userId}
              onChange={(v) => table.setFilter('userId', v)}
              placeholder="UUID"
            />
          </Field>

          <Field label="From" className="w-36">
            <Input
              type="date"
              value={table.filters.from}
              onChange={(e) => table.setFilter('from', e.target.value)}
            />
          </Field>
          <Field label="To" className="w-36">
            <Input
              type="date"
              value={table.filters.to}
              onChange={(e) => table.setFilter('to', e.target.value)}
            />
          </Field>
        </FilterBar>

        <DataTable
          columns={columns}
          rows={data?.data}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          onRowClick={(row) => navigate(`/payments/${row.id}`)}
          emptyIcon={CreditCard}
          emptyTitle="No payments match these filters"
        />

        <Pagination
          meta={data?.meta}
          onPageChange={table.setPage}
          onLimitChange={table.changeLimit}
        />
      </Card>
    </>
  );
}
