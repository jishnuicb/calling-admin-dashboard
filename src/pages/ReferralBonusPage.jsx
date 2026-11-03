import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { referralsApi } from '../api/endpoints';
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
  PageHeader,
} from '../components/ui';

export function ReferralBonusPage() {
  const { can } = useAuth();
  const writable = can(P.REFERRALS_WRITE);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.referralBonusSettings,
    queryFn: () => referralsApi.bonusSettings(),
  });

  const [form, setForm] = useState(null);

  useEffect(() => {
    if (!data) return;
    setForm((prev) =>
      prev
        ? prev
        : {
            defaultBonusAmountRupees: data.defaultBonusAmountRupees ?? 0,
            defaultIncentiveAmountRupees: data.defaultIncentiveAmountRupees ?? 0,
          },
    );
  }, [data]);

  const save = useApiMutation({
    mutationFn: (body) => referralsApi.updateBonusSettings(body),
    successMessage: 'Referral bonus settings saved',
    invalidate: [['referrals']],
    onSuccess: (updated) => {
      setForm({
        defaultBonusAmountRupees: updated.defaultBonusAmountRupees ?? 0,
        defaultIncentiveAmountRupees: updated.defaultIncentiveAmountRupees ?? 0,
      });
    },
  });

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <>
      <PageHeader
        title="Referral Bonus"
        description="Default one-time referral bonus and default weekly incentive amounts (rupees). Used when creating referrals without overrides."
      />

      <Card className="max-w-xl space-y-5 p-6">
        {error && !form && <ErrorState error={error} onRetry={refetch} />}
        {isLoading && !form && <p className="text-sm text-ink-500">Loading settings…</p>}
        {form && (
          <>
            {save.error && <ErrorState error={save.error} compact />}
            <Field
              label="Default referral bonus (₹)"
              hint="One-time amount credited into the first incentive week when eligible."
            >
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.defaultBonusAmountRupees}
                disabled={!writable || save.isPending}
                onChange={(e) => set('defaultBonusAmountRupees', e.target.value)}
              />
            </Field>
            <Field
              label="Default weekly incentive (₹)"
              hint="Applied to each selected incentive week unless overridden on create."
            >
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.defaultIncentiveAmountRupees}
                disabled={!writable || save.isPending}
                onChange={(e) => set('defaultIncentiveAmountRupees', e.target.value)}
              />
            </Field>
            {writable ? (
              <div className="flex justify-end">
                <Button
                  loading={save.isPending}
                  onClick={() =>
                    save.mutate({
                      defaultBonusAmountRupees: Number(form.defaultBonusAmountRupees),
                      defaultIncentiveAmountRupees: Number(form.defaultIncentiveAmountRupees),
                    })
                  }
                >
                  Save settings
                </Button>
              </div>
            ) : (
              <p className="text-xs text-ink-500">
                You need <code>referrals:write</code> to edit settings.
              </p>
            )}
          </>
        )}
      </Card>
    </>
  );
}
