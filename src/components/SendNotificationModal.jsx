import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { useApiMutation } from '../hooks/useApiMutation';
import {
  Button,
  ErrorState,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
} from './ui';

/**
 * Admin push to a single user. Uses POST /admin/notifications/users/:userId/send.
 */
export function SendNotificationModal({ open, onClose, userId, userLabel }) {
  const [form, setForm] = useState({ title: '', body: '', templateKey: '', channel: 'BOTH' });

  const { data: templates } = useQuery({
    queryKey: qk.templates,
    queryFn: () => notificationsApi.templates(),
    enabled: open && Boolean(userId),
  });

  const mutation = useApiMutation({
    mutationFn: () => {
      const payload = { channel: form.channel };
      if (form.templateKey) {
        payload.templateKey = form.templateKey;
      } else {
        payload.title = form.title.trim();
        payload.body = form.body.trim();
      }
      return notificationsApi.sendToUser(userId, payload);
    },
    successMessage: (data) =>
      data?.sent > 0
        ? 'Notification sent'
        : 'Queued — no active device token (logged as failed/skipped)',
    invalidate: [['notifications', 'history']],
    onSuccess: () => {
      setForm({ title: '', body: '', templateKey: '', channel: 'BOTH' });
      onClose();
    },
  });

  const usingTemplate = Boolean(form.templateKey);
  const canSend = usingTemplate || (form.title.trim() && form.body.trim());

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Send notification"
      description={`Push message to ${userLabel || 'this user'} only. Delivered via FCM when they have a registered device.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!canSend || !userId}
          >
            Send
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {mutation.error && <ErrorState error={mutation.error} compact />}

        <Field label="Template" hint="Optional. Choosing a template uses its stored title/body.">
          <Select
            value={form.templateKey}
            onChange={(e) => setForm({ ...form, templateKey: e.target.value })}
          >
            <option value="">Custom message</option>
            {(templates?.data || []).map((t) => (
              <option key={t.key} value={t.key} disabled={t.active === false}>
                {t.name || t.key}
                {t.active === false ? ' (inactive)' : ''}
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
                maxLength={200}
                placeholder="Account update"
              />
            </Field>
            <Field label="Message" required>
              <Textarea
                rows={4}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                maxLength={1000}
                placeholder="Write the notification the user will see…"
              />
            </Field>
          </>
        )}

        <Field label="Channel">
          <Select
            value={form.channel}
            onChange={(e) => setForm({ ...form, channel: e.target.value })}
          >
            <option value="BOTH">Push (default)</option>
            <option value="PUSH">Push</option>
            <option value="SOCKET">Push (socket setting ignored)</option>
          </Select>
        </Field>
      </div>
    </Modal>
  );
}
