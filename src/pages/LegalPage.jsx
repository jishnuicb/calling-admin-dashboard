import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { legalApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { useApiMutation } from '../hooks/useApiMutation';
import { useAuth } from '../auth/AuthContext';
import { P } from '../auth/permissions';
import {
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  LoadingBlock,
  PageHeader,
  Tabs,
  Textarea,
} from '../components/ui';
import { fmtDateTime } from '../lib/format';

const DOCS = [
  {
    slug: 'privacy-policy',
    label: 'Privacy policy',
    description: 'Shown in the Flutter app via GET /legal/privacy-policy',
  },
  {
    slug: 'terms-of-service',
    label: 'Terms of service',
    description: 'Shown in the Flutter app via GET /legal/terms-of-service',
  },
];

function LegalEditor({ slug, description }) {
  const { can } = useAuth();
  const canWrite = can(P.LEGAL_WRITE);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.legal(slug),
    queryFn: () => legalApi.get(slug),
  });

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    if (data) {
      setTitle(data.title || '');
      setBody(data.body || '');
    }
  }, [data]);

  const mutation = useApiMutation({
    mutationFn: () => legalApi.upsert(slug, { title, body }),
    successMessage: 'Legal document saved',
    invalidate: [qk.legalList, qk.legal(slug)],
  });

  if (isLoading) return <LoadingBlock label="Loading document…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const dirty = title !== (data?.title || '') || body !== (data?.body || '');

  return (
    <Card title={data?.title || slug} description={description}>
      <div className="space-y-4">
        {mutation.error && <ErrorState error={mutation.error} compact />}

        <Field label="Title" required>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!canWrite}
            maxLength={200}
          />
        </Field>

        <Field
          label="Body"
          required
          hint="Plain text or markdown. Flutter renders this content as-is."
        >
          <Textarea
            rows={18}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={!canWrite}
            className="font-mono text-sm"
          />
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4">
          <p className="text-xs text-ink-500">
            Last updated {fmtDateTime(data?.updatedAt)}
            {data?.slug && (
              <span className="ml-2 font-mono text-ink-400">· {data.slug}</span>
            )}
          </p>
          {canWrite && (
            <Button
              onClick={() => mutation.mutate()}
              loading={mutation.isPending}
              disabled={!dirty || !title.trim() || !body.trim()}
            >
              Save changes
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

export function LegalPage() {
  const [tab, setTab] = useState(DOCS[0].slug);
  const current = DOCS.find((d) => d.slug === tab) || DOCS[0];

  return (
    <>
      <PageHeader
        title="Legal documents"
        description="Privacy policy and terms of service served to the mobile app. Edits go live immediately."
      />

      <Tabs
        tabs={DOCS.map((d) => ({ id: d.slug, label: d.label }))}
        active={tab}
        onChange={setTab}
      />

      <LegalEditor slug={current.slug} description={current.description} />
    </>
  );
}
