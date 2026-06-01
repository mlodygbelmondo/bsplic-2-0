import { useEffect, useMemo, useState } from 'react';
import { BadgePlus, Power } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { createDefaultBonusCampaignForm } from '@/features/bonus-campaigns/constants';
import {
  formatBonusAmount,
  getBonusCampaignAdminStatus,
  validateBonusCampaignForm,
} from '@/features/bonus-campaigns/campaign-availability';
import {
  createBonusCampaign,
  deactivateBonusCampaign,
  fetchAdminBonusCampaigns,
} from '@/features/bonus-campaigns/bonus-campaign-api';
import type { BonusCampaignWithClaimCount } from '@/features/bonus-campaigns/types';

const STATUS_LABELS = {
  scheduled: 'Zaplanowana',
  active: 'Aktywna',
  expired: 'Wygasła',
  disabled: 'Wyłączona',
} as const;

const STATUS_CLASSES = {
  scheduled: 'bg-blue-100 text-blue-800',
  active: 'bg-emerald-100 text-emerald-800',
  expired: 'bg-muted text-muted-foreground',
  disabled: 'bg-amber-100 text-amber-900',
} as const;

export default function BonusCampaignsTab() {
  const [campaigns, setCampaigns] = useState<BonusCampaignWithClaimCount[]>([]);
  const [form, setForm] = useState(() => createDefaultBonusCampaignForm());
  const [creating, setCreating] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  const fetchCampaigns = async () => {
    try {
      setCampaigns(await fetchAdminBonusCampaigns());
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Nie udało się pobrać kampanii'));
    }
  };

  useEffect(() => {
    void fetchCampaigns();
  }, []);

  const sortedCampaigns = useMemo(
    () =>
      [...campaigns].sort(
        (left, right) =>
          new Date(right.created_at).getTime() -
          new Date(left.created_at).getTime(),
      ),
    [campaigns],
  );

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();

    const validationError = validateBonusCampaignForm(form);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setCreating(true);
    try {
      await createBonusCampaign(form);
      toast.success('Kampania bonusowa utworzona');
      setForm(createDefaultBonusCampaignForm());
      await fetchCampaigns();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Nie udało się utworzyć kampanii'));
    } finally {
      setCreating(false);
    }
  };

  const handleDeactivate = async (campaignId: string) => {
    setDeactivatingId(campaignId);
    try {
      await deactivateBonusCampaign(campaignId);
      toast.success('Kampania została wyłączona');
      await fetchCampaigns();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Nie udało się wyłączyć kampanii'));
    } finally {
      setDeactivatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleCreate}
        className="bg-card rounded-xl p-4 sm:p-6 card-shadow space-y-4"
      >
        <div className="flex items-center gap-2">
          <BadgePlus className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-base">Nowa kampania bonusowa</h3>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="bonus-title">Tytuł</Label>
            <Input
              id="bonus-title"
              value={form.title}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  title: event.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="bonus-description">Opis</Label>
            <Textarea
              id="bonus-description"
              value={form.description}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  description: event.target.value,
                }))
              }
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bonus-amount">Kwota (zł)</Label>
            <Input
              id="bonus-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  amount: event.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bonus-starts-at">Start</Label>
            <Input
              id="bonus-starts-at"
              type="datetime-local"
              value={form.startsAt}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  startsAt: event.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="bonus-expires-at">Wygaśnięcie</Label>
            <Input
              id="bonus-expires-at"
              type="datetime-local"
              value={form.expiresAt}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  expiresAt: event.target.value,
                }))
              }
            />
          </div>
        </div>

        <Button type="submit" disabled={creating} className="w-full sm:w-auto">
          {creating ? 'Tworzenie...' : 'Utwórz kampanię'}
        </Button>
      </form>

      <div className="space-y-3">
        <h3 className="font-semibold text-base">Kampanie</h3>

        {sortedCampaigns.length === 0 ? (
          <div className="bg-card rounded-xl p-6 card-shadow text-sm text-muted-foreground">
            Brak kampanii bonusowych.
          </div>
        ) : (
          sortedCampaigns.map((campaign) => {
            const status = getBonusCampaignAdminStatus(campaign);

            return (
              <div
                key={campaign.id}
                className="bg-card rounded-xl p-4 sm:p-5 card-shadow space-y-3"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold text-base truncate">
                        {campaign.title}
                      </h4>
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
                          STATUS_CLASSES[status],
                        )}
                      >
                        {STATUS_LABELS[status]}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {campaign.description}
                    </p>
                  </div>

                  {campaign.is_active ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => void handleDeactivate(campaign.id)}
                      disabled={deactivatingId === campaign.id}
                    >
                      <Power className="h-4 w-4 mr-1.5" />
                      {deactivatingId === campaign.id
                        ? 'Wyłączanie...'
                        : 'Wyłącz'}
                    </Button>
                  ) : null}
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Kwota</p>
                    <p className="font-semibold">
                      {formatBonusAmount(campaign.amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Start</p>
                    <p className="font-medium">
                      {new Date(campaign.starts_at).toLocaleString('pl-PL')}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Wygaśnięcie</p>
                    <p className="font-medium">
                      {new Date(campaign.expires_at).toLocaleString('pl-PL')}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Odebrania</p>
                    <p className="font-semibold">{campaign.claim_count}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
