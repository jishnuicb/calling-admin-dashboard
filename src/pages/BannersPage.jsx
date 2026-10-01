import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GalleryHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { bannersApi } from '../api/endpoints';
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
  Toggle,
} from '../components/ui';
import { useTableState } from '../hooks/useTableState';
import { fmtDateTime } from '../lib/format';

const DEFAULT_TZ = 'Asia/Kolkata';

/** Convert API local `YYYY-MM-DDTHH:mm:ss` → datetime-local value. */
function toLocalInput(value) {
  if (!value) return '';
  return String(value).slice(0, 16);
}

function splitDateTime(value) {
  const v = toLocalInput(value);
  if (!v || !v.includes('T')) return { date: '', time: '' };
  const [date, time] = v.split('T');
  return { date: date || '', time: (time || '').slice(0, 5) };
}

function joinDateTime(date, time) {
  if (!date) return '';
  return `${date}T${time || '00:00'}`;
}

/** Separate date + time inputs with an explicit Done control (native datetime-local pickers often have no OK). */
function DateTimeFields({ label, value, onChange }) {
  const { date, time } = splitDateTime(value);
  const [draftDate, setDraftDate] = useState(date);
  const [draftTime, setDraftTime] = useState(time || '00:00');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setDraftDate(date);
      setDraftTime(time || '00:00');
    }
  }, [date, time, open]);

  const display = value
    ? `${date || '—'} ${time || '00:00'}`
    : 'Pick date & time';

  const apply = () => {
    if (!draftDate) return;
    onChange(joinDateTime(draftDate, draftTime || '00:00'));
    setOpen(false);
  };

  return (
    <Field label={label}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg border border-ink-200 bg-white px-3 py-2 text-left text-sm text-ink-900 shadow-sm hover:border-ink-300"
        >
          <span className={value ? 'tabular' : 'text-ink-400'}>{display}</span>
          <span className="text-xs text-ink-500">{open ? 'Close' : 'Change'}</span>
        </button>
        {open && (
          <div className="absolute left-0 right-0 z-20 mt-1.5 rounded-xl border border-ink-200 bg-white p-3 shadow-lg">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block text-xs font-medium text-ink-600">
                Date
                <Input
                  type="date"
                  className="mt-1"
                  value={draftDate}
                  onChange={(e) => setDraftDate(e.target.value)}
                />
              </label>
              <label className="block text-xs font-medium text-ink-600">
                Time
                <Input
                  type="time"
                  className="mt-1"
                  value={draftTime}
                  onChange={(e) => setDraftTime(e.target.value)}
                />
              </label>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" size="sm" disabled={!draftDate} onClick={apply}>
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </Field>
  );
}

function BannerFormModal({ open, onClose, banner }) {
  const editing = Boolean(banner);
  const [form, setForm] = useState({
    title: '',
    description: '',
    image: '',
    audience: 'BOTH',
    startAt: '',
    endAt: '',
    timezone: DEFAULT_TZ,
    enabled: true,
    sortOrder: 0,
  });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setUploadError(null);
    if (banner) {
      setForm({
        title: banner.title || '',
        description: banner.description || '',
        image: banner.image || '',
        audience: banner.audience || 'BOTH',
        startAt: toLocalInput(banner.startAtLocal || banner.startAt),
        endAt: toLocalInput(banner.endAtLocal || banner.endAt),
        timezone: banner.timezone || DEFAULT_TZ,
        enabled: banner.enabled !== false,
        sortOrder: banner.sortOrder ?? 0,
      });
    } else {
      setForm({
        title: '',
        description: '',
        image: '',
        audience: 'BOTH',
        startAt: '',
        endAt: '',
        timezone: DEFAULT_TZ,
        enabled: true,
        sortOrder: 0,
      });
    }
  }, [open, banner]);

  const mutation = useApiMutation({
    mutationFn: () => {
      const body = {
        title: form.title.trim(),
        description: form.description.trim(),
        image: form.image.trim() || null,
        audience: form.audience || 'BOTH',
        startAt: form.startAt,
        endAt: form.endAt,
        timezone: form.timezone || DEFAULT_TZ,
        enabled: form.enabled,
        sortOrder: Number(form.sortOrder) || 0,
      };
      return editing ? bannersApi.update(banner.id, body) : bannersApi.create(body);
    },
    successMessage: editing ? 'Banner updated' : 'Banner created',
    invalidate: [['banners']],
    onSuccess: onClose,
  });

  const onPickImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await bannersApi.uploadImage(fd);
      setForm((f) => ({ ...f, image: res.image || '' }));
    } catch (err) {
      setUploadError(err);
    } finally {
      setUploading(false);
    }
  };

  const valid =
    form.title.trim().length >= 1 &&
    form.description.trim().length >= 1 &&
    form.startAt &&
    form.endAt;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? 'Edit banner' : 'Create banner'}
      description={`Times are interpreted in ${form.timezone || DEFAULT_TZ}. Only enabled banners inside the window appear in the app list.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid || uploading}
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {editing ? 'Save' : 'Create'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {mutation.error && <ErrorState error={mutation.error} compact />}
        {uploadError && <ErrorState error={uploadError} compact />}
        <Field label="Title">
          <Input
            value={form.title}
            maxLength={200}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </Field>
        <Field label="Description">
          <Textarea
            rows={4}
            value={form.description}
            maxLength={5000}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </Field>
        <Field
          label="Image"
          hint="Optional. Upload a file or paste a public URL. Sent to the app as key image."
        >
          <div className="space-y-2">
            {form.image ? (
              <div className="flex items-start gap-3">
                <img
                  src={form.image}
                  alt=""
                  className="h-20 w-32 rounded-lg object-cover ring-1 ring-ink-200"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setForm((f) => ({ ...f, image: '' }))}
                >
                  Remove
                </Button>
              </div>
            ) : null}
            <Input
              type="url"
              value={form.image}
              placeholder="https://…"
              onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))}
            />
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-brand-600 hover:underline">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                disabled={uploading}
                onChange={onPickImage}
              />
              {uploading ? 'Uploading…' : 'Upload image'}
            </label>
          </div>
        </Field>
        <Field label="Audience">
          <Select
            value={form.audience}
            onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}
          >
            <option value="BOTH">Both (caller + listener)</option>
            <option value="CALLER">Caller only</option>
            <option value="LISTENER">Listener only</option>
          </Select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <DateTimeFields
            label="Start (date & time)"
            value={form.startAt}
            onChange={(startAt) => setForm((f) => ({ ...f, startAt }))}
          />
          <DateTimeFields
            label="End (date & time)"
            value={form.endAt}
            onChange={(endAt) => setForm((f) => ({ ...f, endAt }))}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Timezone" hint="IANA zone used for the wall times above">
            <Input
              value={form.timezone}
              onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
              placeholder={DEFAULT_TZ}
            />
          </Field>
          <Field label="Sort order">
            <Input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
            />
          </Field>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink-700">
            {form.enabled ? 'Enabled' : 'Disabled'}
          </p>
          <Toggle
            checked={form.enabled}
            onChange={(checked) => setForm((f) => ({ ...f, enabled: checked }))}
            label={form.enabled ? 'Shown when in window' : 'Hidden from app'}
          />
        </div>
      </div>
    </Modal>
  );
}

function windowBadge(row) {
  const now = Date.now();
  const start = new Date(row.startAt).getTime();
  const end = new Date(row.endAt).getTime();
  if (!row.enabled) return <Badge tone="neutral">Disabled</Badge>;
  if (now < start) return <Badge tone="warning">Scheduled</Badge>;
  if (now >= end) return <Badge tone="neutral">Ended</Badge>;
  return (
    <Badge tone="success" dot>
      Live
    </Badge>
  );
}

export function BannersPage() {
  const { can } = useAuth();
  const canWrite = can(P.BANNERS_WRITE);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const table = useTableState({ status: '', search: '', audience: '' }, { limit: 20 });
  const params = {
    page: table.page,
    limit: table.pageSize,
    status: table.filters.status || undefined,
    audience: table.filters.audience || undefined,
    search: table.filters.search || undefined,
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.banners(params),
    queryFn: () => bannersApi.list(params),
  });

  const toggle = useApiMutation({
    mutationFn: ({ id, enabled }) => bannersApi.update(id, { enabled }),
    successMessage: (row) => (row.enabled ? 'Banner enabled' : 'Banner disabled'),
    invalidate: [['banners']],
  });

  const remove = useApiMutation({
    mutationFn: (id) => bannersApi.remove(id),
    successMessage: 'Banner deleted',
    invalidate: [['banners']],
  });

  const columns = [
    {
      key: 'title',
      header: 'Banner',
      render: (row) => (
        <div className="flex min-w-0 max-w-sm items-start gap-2.5">
          {row.image ? (
            <img
              src={row.image}
              alt=""
              className="size-10 shrink-0 rounded-md object-cover ring-1 ring-ink-200"
            />
          ) : null}
          <div className="min-w-0">
            <p className="truncate font-medium text-ink-900">{row.title}</p>
            <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{row.description}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'audience',
      header: 'Audience',
      render: (row) => <Badge>{row.audience || 'BOTH'}</Badge>,
    },
    {
      key: 'window',
      header: 'Window',
      render: (row) => (
        <div className="text-xs text-ink-600">
          <p>{fmtDateTime(row.startAt)}</p>
          <p className="text-ink-400">→ {fmtDateTime(row.endAt)}</p>
          <p className="mt-0.5 text-[11px] text-ink-400">{row.timezone}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => windowBadge(row),
    },
    {
      key: 'sortOrder',
      header: 'Sort',
      align: 'right',
      render: (row) => <span className="tabular text-sm">{row.sortOrder}</span>,
    },
    ...(canWrite
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right',
            render: (row) => (
              <div className="flex flex-wrap justify-end gap-2">
                <Toggle
                  checked={row.enabled}
                  disabled={toggle.isPending}
                  onChange={(checked) => toggle.mutate({ id: row.id, enabled: checked })}
                  label={row.enabled ? 'On' : 'Off'}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setEditing(row);
                    setFormOpen(true);
                  }}
                >
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    if (window.confirm(`Delete banner “${row.title}”?`)) remove.mutate(row.id);
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Banners"
        description="Scheduled title/description banners for the app. The public list only returns enabled banners between start and end (timezone stored per banner)."
        actions={
          canWrite ? (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" />
              New banner
            </Button>
          ) : null
        }
      />

      <Card bodyClassName="">
        <FilterBar onReset={table.isFiltered ? table.reset : undefined}>
          <Field label="Search" className="w-full sm:w-56">
            <Input
              value={table.filters.search}
              onChange={(e) => table.setFilter('search', e.target.value)}
              placeholder="Title or description"
            />
          </Field>
          <Field label="Status" className="w-40">
            <Select
              value={table.filters.status}
              onChange={(e) => table.setFilter('status', e.target.value)}
            >
              <option value="">All</option>
              <option value="active">Live now</option>
              <option value="scheduled">Scheduled</option>
              <option value="ended">Ended</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </Select>
          </Field>
          <Field label="Audience" className="w-40">
            <Select
              value={table.filters.audience}
              onChange={(e) => table.setFilter('audience', e.target.value)}
            >
              <option value="">All</option>
              <option value="BOTH">Both</option>
              <option value="CALLER">Caller</option>
              <option value="LISTENER">Listener</option>
            </Select>
          </Field>
        </FilterBar>

        <DataTable
          columns={columns}
          rows={data?.data}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          emptyIcon={GalleryHorizontal}
          emptyTitle="No banners yet"
        />

        <Pagination
          meta={data?.meta}
          onPageChange={table.setPage}
          onLimitChange={table.changeLimit}
        />
      </Card>

      <BannerFormModal
        open={formOpen}
        banner={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
      />
    </>
  );
}
