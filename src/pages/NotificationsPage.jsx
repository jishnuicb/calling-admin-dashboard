import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, Megaphone, Send } from 'lucide-react';
import { notificationsApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { useApiMutation } from '../hooks/useApiMutation';
import { useAuth } from '../auth/AuthContext';
import { P } from '../auth/permissions';
import { DataTable, FilterBar, Pagination } from '../components/DataTable';
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  JsonBlock,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  StatusBadge,
  Tabs,
  Textarea,
  Toggle,
  ErrorState,
} from '../components/ui';
import { useTableState } from '../hooks/useTableState';
import { fmtDateTime, shortId, titleCase } from '../lib/format';

// --- Templates --------------------------------------------------------------

function TemplateModal({ template, onClose }) {
  const [form, setForm] = useState({
    key: template?.key || '',
    name: template?.name || '',
    title: template?.title || '',
    body: template?.body || '',
    channel: template?.channel || 'BOTH',
    active: template?.active ?? true,
    description: template?.description || '',
  });

  const mutation = useApiMutation({
    mutationFn: () =>
      notificationsApi.upsertTemplate(form.key, {
        name: form.name || undefined,
        title: form.title,
        body: form.body,
        channel: form.channel,
        active: form.active,
        description: form.description || undefined,
      }),
    successMessage: 'Template saved',
    invalidate: [qk.templates],
    onSuccess: onClose,
  });

  const fieldErrors = mutation.error?.fieldErrors || {};

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={template ? `Edit ${template.key}` : 'Create a template'}
      description="Templates support {{placeholder}} interpolation filled in by the sending service."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!form.key.trim() || !form.title.trim() || !form.body.trim()}
          >
            Save template
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {mutation.error && <ErrorState error={mutation.error} compact />}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Key"
            required
            hint={template ? 'The key identifies the template and cannot change.' : 'e.g. listener.approved'}
          >
            <Input
              value={form.key}
              disabled={Boolean(template)}
              onChange={(e) => setForm({ ...form, key: e.target.value })}
              placeholder="listener.approved"
            />
          </Field>
          <Field label="Name" error={fieldErrors.name}>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Listener approved"
            />
          </Field>
        </div>

        <Field label="Title" required error={fieldErrors.title}>
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="You're approved!"
          />
        </Field>

        <Field
          label="Body"
          required
          hint="Placeholders like {{name}} are substituted at send time."
          error={fieldErrors.body}
        >
          <Textarea
            rows={4}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            placeholder="Hi {{name}}, your listener application has been approved. Go online to start receiving calls."
          />
        </Field>

        <div className="grid items-end gap-4 sm:grid-cols-2">
          <Field label="Channel" hint="SOCKET reaches only connected clients.">
            <Select
              value={form.channel}
              onChange={(e) => setForm({ ...form, channel: e.target.value })}
            >
              <option value="BOTH">Both push and socket</option>
              <option value="PUSH">Push only (FCM)</option>
              <option value="SOCKET">Socket only</option>
            </Select>
          </Field>
          <Toggle
            checked={form.active}
            onChange={(v) => setForm({ ...form, active: v })}
            label="Active"
          />
        </div>

        <Field label="Description" hint="Internal note about when this fires.">
          <Input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
      </div>
    </Modal>
  );
}

function TemplatesTab() {
  const { can } = useAuth();
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.templates,
    queryFn: () => notificationsApi.templates(),
  });

  const rows = data?.data || data || [];
  const writable = can(P.NOTIFICATIONS_TEMPLATES);

  const columns = [
    {
      key: 'key',
      header: 'Key',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-mono text-xs font-medium text-ink-900">{row.key}</p>
          {row.name && <p className="truncate text-xs text-ink-500">{row.name}</p>}
        </div>
      ),
    },
    {
      key: 'title',
      header: 'Title',
      render: (row) => <span className="text-sm text-ink-800">{row.title}</span>,
    },
    {
      key: 'body',
      header: 'Body',
      render: (row) => (
        <span className="line-clamp-2 max-w-md text-xs text-ink-600" title={row.body}>
          {row.body}
        </span>
      ),
    },
    {
      key: 'channel',
      header: 'Channel',
      render: (row) => <Badge tone="info">{row.channel}</Badge>,
    },
    {
      key: 'active',
      header: 'Active',
      render: (row) => (
        <Badge tone={row.active ? 'success' : 'neutral'}>{row.active ? 'Yes' : 'No'}</Badge>
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
        title="Notification templates"
        description="System events reference these by key, so the copy can be reworded without a deployment."
        actions={
          writable && (
            <Button size="sm" onClick={() => setCreating(true)}>
              New template
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
          emptyIcon={Bell}
          emptyTitle="No templates yet"
          emptyDescription="Run the backend seed to install the defaults."
        />
      </Card>

      {(editing || creating) && (
        <TemplateModal
          template={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </>
  );
}

// --- Send -------------------------------------------------------------------

function SendTab() {
  const [form, setForm] = useState({
    audience: 'ALL',
    userIds: '',
    templateKey: '',
    title: '',
    body: '',
    channel: 'BOTH',
    data: '',
  });
  const [result, setResult] = useState(null);

  const { data: templates } = useQuery({
    queryKey: qk.templates,
    queryFn: () => notificationsApi.templates(),
  });

  const mutation = useApiMutation({
    mutationFn: () => {
      const payload = { audience: form.audience, channel: form.channel };

      if (form.audience === 'SPECIFIC') {
        payload.userIds = form.userIds
          .split(/[\s,]+/)
          .map((s) => s.trim())
          .filter(Boolean);
      }

      // A template supplies the copy; otherwise title and body are required.
      if (form.templateKey) {
        payload.templateKey = form.templateKey;
      } else {
        payload.title = form.title;
        payload.body = form.body;
      }

      if (form.data.trim()) {
        try {
          payload.data = JSON.parse(form.data);
        } catch {
          throw Object.assign(new Error('The data payload is not valid JSON.'), {
            statusCode: 400,
            code: 'INVALID_JSON',
          });
        }
      }

      return notificationsApi.send(payload);
    },
    successMessage: (data) =>
      `Queued for ${data.queued ?? data.recipients ?? 'the selected'} recipient(s)`,
    invalidate: [['notifications', 'history']],
    onSuccess: (data) => setResult(data),
  });

  const usingTemplate = Boolean(form.templateKey);
  const specificCount = form.userIds.split(/[\s,]+/).filter(Boolean).length;

  const canSend =
    (usingTemplate || (form.title.trim() && form.body.trim())) &&
    (form.audience !== 'SPECIFIC' || specificCount > 0);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Compose" className="lg:col-span-2">
        <div className="space-y-4">
          {mutation.error && <ErrorState error={mutation.error} compact />}

          <Field label="Audience" required>
            <Select
              value={form.audience}
              onChange={(e) => setForm({ ...form, audience: e.target.value })}
            >
              <option value="ALL">Everyone</option>
              <option value="CALLERS">Callers (users without an approved application)</option>
              <option value="LISTENERS">Approved listeners</option>
              <option value="SPECIFIC">Specific user ids</option>
            </Select>
          </Field>

          {form.audience === 'SPECIFIC' && (
            <Field
              label="User ids"
              required
              hint={`Comma, space or newline separated. ${specificCount} id(s) entered.`}
            >
              <Textarea
                rows={3}
                value={form.userIds}
                onChange={(e) => setForm({ ...form, userIds: e.target.value })}
                className="font-mono text-xs"
                placeholder="9f1c2e40-…, 3ab77c12-…"
              />
            </Field>
          )}

          <Field
            label="Template"
            hint="Choosing a template uses its stored copy and ignores the title and body below."
          >
            <Select
              value={form.templateKey}
              onChange={(e) => setForm({ ...form, templateKey: e.target.value })}
            >
              <option value="">Write a one-off message</option>
              {(templates?.data || templates || [])
                .filter((t) => t.active)
                .map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.key} — {t.title}
                  </option>
                ))}
            </Select>
          </Field>

          {!usingTemplate && (
            <>
              <Field label="Title" required>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Weekend bonus is live"
                />
              </Field>
              <Field label="Body" required>
                <Textarea
                  rows={4}
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  placeholder="Talk 60 minutes this week and earn bonus tokens."
                />
              </Field>
            </>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Channel">
              <Select
                value={form.channel}
                onChange={(e) => setForm({ ...form, channel: e.target.value })}
              >
                <option value="BOTH">Both push and socket</option>
                <option value="PUSH">Push only (FCM)</option>
                <option value="SOCKET">Socket only (connected clients)</option>
              </Select>
            </Field>
          </div>

          <Field
            label="Data payload"
            hint="Optional JSON passed to the client for deep linking."
          >
            <Textarea
              rows={3}
              value={form.data}
              onChange={(e) => setForm({ ...form, data: e.target.value })}
              className="font-mono text-xs"
              placeholder='{"screen":"wallet"}'
            />
          </Field>

          <div className="flex items-center gap-3 border-t border-ink-100 pt-4">
            <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={!canSend}>
              <Send className="size-4" />
              Send notification
            </Button>
            {form.audience === 'ALL' && (
              <p className="text-xs text-amber-700">
                This reaches every user on the platform. There is no undo.
              </p>
            )}
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        <Card title="How delivery works">
          <ul className="space-y-2.5 text-xs text-ink-600">
            <li>
              <span className="font-medium text-ink-800">Push (FCM)</span> reaches users whose
              device tokens are registered, even when the app is closed. Invalid tokens are pruned
              automatically.
            </li>
            <li>
              <span className="font-medium text-ink-800">Socket</span> only reaches clients
              connected right now, so it is best used alongside push rather than alone.
            </li>
            <li>
              Every recipient gets a row in the delivery history, including{' '}
              <span className="font-medium">SKIPPED</span> for users with no registered device.
            </li>
          </ul>
        </Card>

        {result && (
          <Card title="Send result">
            <JsonBlock value={result} maxHeight="16rem" />
          </Card>
        )}
      </div>
    </div>
  );
}

// --- History ----------------------------------------------------------------

function HistoryTab() {
  const table = useTableState({ userId: '', templateKey: '', status: '', isBroadcast: '' });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.notificationHistory(table.params),
    queryFn: () => notificationsApi.history(table.params),
  });

  const columns = [
    {
      key: 'title',
      header: 'Notification',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink-900">{row.title}</p>
          <p className="truncate text-xs text-ink-500" title={row.body}>
            {row.body}
          </p>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'channel',
      header: 'Channel',
      render: (row) => <span className="text-xs text-ink-600">{row.channel}</span>,
    },
    {
      key: 'recipient',
      header: 'Recipient',
      render: (row) =>
        row.isBroadcast ? (
          <Badge tone="info">Broadcast</Badge>
        ) : (
          <span className="text-xs text-ink-600">{row.user?.name || shortId(row.userId)}</span>
        ),
    },
    {
      key: 'templateKey',
      header: 'Template',
      render: (row) =>
        row.templateKey ? (
          <span className="font-mono text-[11px] text-ink-600">{row.templateKey}</span>
        ) : (
          <span className="text-xs text-ink-400">one-off</span>
        ),
    },
    {
      key: 'failureReason',
      header: 'Failure',
      render: (row) =>
        row.failureReason ? (
          <span className="text-xs text-red-600" title={row.failureReason}>
            {row.failureReason.slice(0, 40)}
          </span>
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
    {
      key: 'createdAt',
      header: 'Sent',
      render: (row) => (
        <span className="text-xs text-ink-600">{fmtDateTime(row.sentAt || row.createdAt)}</span>
      ),
    },
  ];

  return (
    <Card title="Delivery history" bodyClassName="">
      <FilterBar onReset={table.isFiltered ? table.reset : undefined}>
        <Field label="Status" className="w-36">
          <Select
            value={table.filters.status}
            onChange={(e) => table.setFilter('status', e.target.value)}
          >
            <option value="">All</option>
            {['QUEUED', 'SENT', 'FAILED', 'SKIPPED'].map((s) => (
              <option key={s} value={s}>
                {titleCase(s)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Template key" className="w-44">
          <SearchInput
            value={table.filters.templateKey}
            onChange={(v) => table.setFilter('templateKey', v)}
            placeholder="listener.approved"
          />
        </Field>
        <Field label="User id" className="w-44">
          <SearchInput
            value={table.filters.userId}
            onChange={(v) => table.setFilter('userId', v)}
            placeholder="UUID"
          />
        </Field>
        <Field label="Kind" className="w-36">
          <Select
            value={table.filters.isBroadcast}
            onChange={(e) => table.setFilter('isBroadcast', e.target.value)}
          >
            <option value="">All</option>
            <option value="true">Broadcast only</option>
            <option value="false">Targeted only</option>
          </Select>
        </Field>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={data?.data}
        loading={isLoading}
        error={error}
        onRetry={refetch}
        emptyIcon={Bell}
        emptyTitle="No notifications sent yet"
        dense
      />

      <Pagination
        meta={data?.meta}
        onPageChange={table.setPage}
        onLimitChange={table.changeLimit}
      />
    </Card>
  );
}

export function NotificationsPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState('history');

  const tabs = [
    { id: 'history', label: 'Delivery history' },
    ...(can(P.NOTIFICATIONS_SEND) ? [{ id: 'send', label: 'Send' }] : []),
    { id: 'templates', label: 'Templates' },
  ];

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Push and socket delivery, templates, and the full delivery log."
        actions={
          can(P.NOTIFICATIONS_SEND) &&
          tab !== 'send' && (
            <Button onClick={() => setTab('send')}>
              <Megaphone className="size-4" />
              Send notification
            </Button>
          )
        }
      />

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'history' && <HistoryTab />}
      {tab === 'send' && <SendTab />}
      {tab === 'templates' && <TemplatesTab />}
    </>
  );
}
