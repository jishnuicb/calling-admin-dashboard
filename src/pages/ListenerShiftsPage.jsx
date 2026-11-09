import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Plus } from 'lucide-react';
import { listenersApi } from '../api/endpoints';
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
  Textarea,
} from '../components/ui';
import { useTableState } from '../hooks/useTableState';
import { fmtDateTime, shortId } from '../lib/format';

function personLabel(person, fallbackId) {
  if (!person) return shortId(fallbackId);
  const name = person.displayName || person.name;
  if (name && person.publicId) return `${name} · ${person.publicId}`;
  if (name) return name;
  if (person.publicId) return person.publicId;
  return shortId(person.id || fallbackId);
}

function StatusBadge({ status }) {
  const tone = status === 'ACTIVE' ? 'success' : 'danger';
  return <Badge tone={tone}>{status || '—'}</Badge>;
}

function ShiftFormModal({ open, onClose, initial }) {
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState(() => ({
    listenerUserId: initial?.listenerUserId || '',
    startDate: initial?.startDate || '',
    endDate: initial?.endDate || '',
    startTime: initial?.startTime || '09:00',
    endTime: initial?.endTime || '17:00',
    note: initial?.note || '',
    status: initial?.status || 'ACTIVE',
  }));
  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = useApiMutation({
    mutationFn: (body) =>
      isEdit ? listenersApi.updateShift(initial.id, body) : listenersApi.createShift(body),
    successMessage: isEdit ? 'Shift updated' : 'Shift created',
    invalidate: [['listeners', 'shifts']],
    onSuccess: () => onClose(),
  });

  const submit = () => {
    if (isEdit) {
      const body = {
        startDate: form.startDate,
        endDate: form.endDate,
        startTime: form.startTime,
        endTime: form.endTime,
        note: form.note.trim() || null,
        status: form.status,
      };
      save.mutate(body);
      return;
    }
    save.mutate({
      listenerUserId: form.listenerUserId.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      startTime: form.startTime,
      endTime: form.endTime,
      note: form.note.trim() || undefined,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? 'Edit shift' : 'Add shift'}
      description="Dates and times are IST. A listener can have multiple shifts. Overnight shifts are allowed (end time earlier than start time)."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.isPending} onClick={submit}>
            {isEdit ? 'Save changes' : 'Add shift'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {save.error && <ErrorState error={save.error} compact />}
        {!isEdit && (
          <Field label="Listener user ID" required hint="Approved listener UUID">
            <Input
              value={form.listenerUserId}
              placeholder="UUID"
              onChange={(e) => set('listenerUserId', e.target.value)}
            />
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start date" required hint="YYYY-MM-DD (IST)">
            <Input
              type="date"
              value={form.startDate}
              onChange={(e) => set('startDate', e.target.value)}
            />
          </Field>
          <Field label="End date" required hint="YYYY-MM-DD (IST), inclusive">
            <Input
              type="date"
              value={form.endDate}
              onChange={(e) => set('endDate', e.target.value)}
            />
          </Field>
          <Field label="Start time" required hint="HH:mm IST">
            <Input
              type="time"
              value={form.startTime}
              onChange={(e) => set('startTime', e.target.value)}
            />
          </Field>
          <Field label="End time" required hint="HH:mm IST">
            <Input
              type="time"
              value={form.endTime}
              onChange={(e) => set('endTime', e.target.value)}
            />
          </Field>
        </div>
        {isEdit && (
          <Field label="Status">
            <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="ACTIVE">ACTIVE</option>
              <option value="STOPPED">STOPPED</option>
            </Select>
          </Field>
        )}
        <Field label="Note">
          <Textarea
            rows={2}
            value={form.note}
            onChange={(e) => set('note', e.target.value)}
            placeholder="Optional"
          />
        </Field>
      </div>
    </Modal>
  );
}

export function ListenerShiftsPage() {
  const { can } = useAuth();
  const writable = can(P.LISTENERS_APPROVE);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);

  const table = useTableState(
    {
      status: '',
      search: '',
      listenerUserId: '',
      fromDate: '',
      toDate: '',
    },
    { limit: 20 },
  );

  const params = {
    ...table.params,
    status: table.filters.status || undefined,
    search: table.filters.search || undefined,
    listenerUserId: table.filters.listenerUserId || undefined,
    fromDate: table.filters.fromDate || undefined,
    toDate: table.filters.toDate || undefined,
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.listenerShifts(params),
    queryFn: () => listenersApi.listShifts(params),
  });

  const remove = useApiMutation({
    mutationFn: (id) => listenersApi.removeShift(id),
    successMessage: 'Shift deleted',
    invalidate: [['listeners', 'shifts']],
  });

  const columns = [
    {
      key: 'listener',
      header: 'Listener',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink-900">
            {personLabel(row.listener, row.listenerUserId)}
          </p>
          <p className="font-mono text-[11px] text-ink-500">{shortId(row.listenerUserId)}</p>
        </div>
      ),
    },
    {
      key: 'dates',
      header: 'Dates (IST)',
      render: (row) => (
        <span className="font-mono text-xs text-ink-800">
          {row.startDate} → {row.endDate}
        </span>
      ),
    },
    {
      key: 'times',
      header: 'Time (IST)',
      render: (row) => (
        <span className="font-mono text-xs text-ink-800">
          {row.startTime} – {row.endTime}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'note',
      header: 'Note',
      render: (row) => <span className="truncate text-xs text-ink-600">{row.note || '—'}</span>,
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-ink-600">{fmtDateTime(row.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) =>
        writable ? (
          <div className="flex flex-wrap justify-end gap-1">
            <Button size="sm" variant="secondary" onClick={() => setEditRow(row)}>
              Edit
            </Button>
            <Button
              size="sm"
              variant="danger"
              loading={remove.isPending && remove.variables === row.id}
              onClick={() => {
                if (!window.confirm('Delete this shift?')) return;
                remove.mutate(row.id);
              }}
            >
              Delete
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Listener shifts"
        description="Shift timings per listener (IST). Multiple shifts allowed. This is scheduling metadata only — it does not change call or discovery APIs."
        actions={
          writable && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Add shift
            </Button>
          )
        }
      />

      <Card bodyClassName="">
        <FilterBar>
          <Field label="Status" className="w-36">
            <Select
              value={table.filters.status}
              onChange={(e) => table.setFilter('status', e.target.value)}
            >
              <option value="">All</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="STOPPED">STOPPED</option>
            </Select>
          </Field>
          <Field label="From date" className="w-44">
            <Input
              type="date"
              value={table.filters.fromDate}
              onChange={(e) => table.setFilter('fromDate', e.target.value)}
            />
          </Field>
          <Field label="To date" className="w-44">
            <Input
              type="date"
              value={table.filters.toDate}
              onChange={(e) => table.setFilter('toDate', e.target.value)}
            />
          </Field>
          <Field label="Search" className="w-48">
            <Input
              value={table.filters.search}
              placeholder="Name or publicId…"
              onChange={(e) => table.setFilter('search', e.target.value)}
            />
          </Field>
          <Field label="Listener user ID" className="w-52">
            <Input
              value={table.filters.listenerUserId}
              placeholder="UUID"
              onChange={(e) => table.setFilter('listenerUserId', e.target.value)}
            />
          </Field>
        </FilterBar>

        {remove.error && (
          <div className="px-5 pt-3">
            <ErrorState error={remove.error} compact />
          </div>
        )}

        <DataTable
          columns={columns}
          rows={data?.data}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          emptyIcon={CalendarClock}
          emptyTitle="No shifts yet"
          emptyDescription="Add one or more IST shift windows for an approved listener."
        />
        <Pagination
          meta={data?.meta}
          onPageChange={table.setPage}
          onLimitChange={table.changeLimit}
        />
      </Card>

      {createOpen && (
        <ShiftFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
      )}
      {editRow && (
        <ShiftFormModal
          open
          initial={editRow}
          onClose={() => setEditRow(null)}
        />
      )}
    </>
  );
}
