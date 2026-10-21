import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgePlus, Power } from 'lucide-react-native';
import { memo, useState } from 'react';
import { Alert, View } from 'react-native';

import { toInputDateTime } from '@/lib/date-input';
import { getErrorMessage } from '@/lib/errors';
import { toast } from '@/lib/toast';
import { createStyles, useTheme, type Colors } from '@/theme';
import { Button, SectionLoader, StateMessage, Text } from '@/ui';
import {
  ADMIN_BONUS_CAMPAIGNS_QUERY_KEY,
  adminBonusCampaignsQueryOptions,
  createBonusCampaign,
  deactivateBonusCampaign,
} from '../b/api/bonus-campaigns';
import { DateTimeField } from '../components/DateTimeField';
import { AdminCard, FormField, Input, OfflineNotice, Pill, TextArea } from '../b/components/primitives';
import { useAdminWriteGuard, useQueryErrorToast } from '../b/hooks';
import {
  createDefaultBonusCampaignForm,
  formatBonusAmount,
  getBonusCampaignAdminStatus,
  validateBonusCampaignForm,
  type BonusCampaignAdminStatus,
  type BonusCampaignForm,
  type BonusCampaignWithClaimCount,
} from '../b/logic/bonus-campaigns';

const STATUS_LABELS: Record<BonusCampaignAdminStatus, string> = {
  scheduled: 'Zaplanowana',
  active: 'Aktywna',
  expired: 'Wygasła',
  disabled: 'Wyłączona',
};

// Tailwind blue-100/800, emerald-100/800, amber-100/900.
function statusTone(status: BonusCampaignAdminStatus, colors: Colors) {
  switch (status) {
    case 'scheduled':
      return { background: '#dbeafe', color: '#1e40af' };
    case 'active':
      return { background: '#d1fae5', color: '#065f46' };
    case 'disabled':
      return { background: '#fef3c7', color: '#78350f' };
    default:
      return { background: colors.muted, color: colors.mutedForeground };
  }
}

/** Admin "Bonusy" tab (web `BonusCampaignsTab`): create and disable campaigns. */
export function BonusCampaignsTab() {
  const styles = useStyles();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const { offline, ensureOnline } = useAdminWriteGuard();
  const query = useQuery(adminBonusCampaignsQueryOptions());
  const [form, setForm] = useState<BonusCampaignForm>(() => createDefaultBonusCampaignForm());
  const [creating, setCreating] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  useQueryErrorToast(query.error, query.errorUpdatedAt, (error) =>
    getErrorMessage(error, 'Nie udało się pobrać kampanii'),
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: ADMIN_BONUS_CAMPAIGNS_QUERY_KEY });
  const update = (patch: Partial<BonusCampaignForm>) => setForm((previous) => ({ ...previous, ...patch }));

  const handleCreate = async () => {
    if (creating) return;
    const validationError = validateBonusCampaignForm(form);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (!ensureOnline()) return;

    setCreating(true);
    try {
      await createBonusCampaign(form);
      toast.success('Kampania bonusowa utworzona');
      setForm(createDefaultBonusCampaignForm());
      await refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Nie udało się utworzyć kampanii'));
    } finally {
      setCreating(false);
    }
  };

  const deactivate = async (campaignId: string) => {
    setDeactivatingId(campaignId);
    try {
      await deactivateBonusCampaign(campaignId);
      toast.success('Kampania została wyłączona');
      await refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Nie udało się wyłączyć kampanii'));
    } finally {
      setDeactivatingId(null);
    }
  };

  const confirmDeactivate = (campaign: BonusCampaignWithClaimCount) => {
    if (!ensureOnline()) return;
    Alert.alert(`Czy na pewno chcesz wyłączyć kampanię "${campaign.title}"?`, undefined, [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Wyłącz', style: 'destructive', onPress: () => void deactivate(campaign.id) },
    ]);
  };

  const campaigns = query.data ?? [];

  return (
    <View style={styles.root}>
      {offline ? <OfflineNotice /> : null}

      <AdminCard style={styles.formCard}>
        <View style={styles.formHeader}>
          <BadgePlus size={20} color={colors.primary} />
          <Text size="base" weight="600">
            Nowa kampania bonusowa
          </Text>
        </View>

        <FormField label="Tytuł">
          <Input value={form.title} onChangeText={(title) => update({ title })} />
        </FormField>
        <FormField label="Opis">
          <TextArea value={form.description} onChangeText={(description) => update({ description })} />
        </FormField>
        <FormField label="Kwota (zł)">
          <Input
            keyboardType="decimal-pad"
            value={form.amount}
            onChangeText={(amount) => update({ amount: amount.replace(',', '.') })}
          />
        </FormField>
        <FormField label="Start">
          <DateTimeField
            accessibilityLabel="Start"
            value={new Date(form.startsAt)}
            onChange={(date) => update({ startsAt: toInputDateTime(date) })}
          />
        </FormField>
        <FormField label="Wygaśnięcie">
          <DateTimeField
            accessibilityLabel="Wygaśnięcie"
            value={new Date(form.expiresAt)}
            onChange={(date) => update({ expiresAt: toInputDateTime(date) })}
          />
        </FormField>

        <Button
          label={creating ? 'Tworzenie...' : 'Utwórz kampanię'}
          disabled={creating || offline}
          onPress={() => void handleCreate()}
          style={styles.tallButton}
        />
      </AdminCard>

      <View style={styles.list}>
        <Text size="base" weight="600">
          Kampanie
        </Text>
        {query.isPending ? (
          <SectionLoader size="sm" />
        ) : query.isError && !query.data ? (
          <StateMessage
            title="Nie udało się pobrać kampanii"
            description={getErrorMessage(query.error, '')}
            actionLabel="Spróbuj ponownie"
            onAction={() => void query.refetch()}
          />
        ) : campaigns.length === 0 ? (
          <AdminCard style={styles.emptyCard}>
            <Text color="mutedForeground">Brak kampanii bonusowych.</Text>
          </AdminCard>
        ) : (
          campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              deactivating={deactivatingId === campaign.id}
              disabled={offline}
              onDeactivate={confirmDeactivate}
            />
          ))
        )}
      </View>
    </View>
  );
}

const CampaignCard = memo(function CampaignCard({
  campaign,
  deactivating,
  disabled,
  onDeactivate,
}: {
  campaign: BonusCampaignWithClaimCount;
  deactivating: boolean;
  disabled: boolean;
  onDeactivate: (campaign: BonusCampaignWithClaimCount) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const status = getBonusCampaignAdminStatus(campaign);
  const tone = statusTone(status, colors);

  return (
    <AdminCard style={styles.campaignCard}>
      <View style={{ gap: 4 }}>
        <View style={styles.titleRow}>
          <Text size="base" weight="600" numberOfLines={1} style={{ flexShrink: 1 }}>
            {campaign.title}
          </Text>
          <Pill label={STATUS_LABELS[status]} background={tone.background} color={tone.color} />
        </View>
        <Text color="mutedForeground">{campaign.description}</Text>
      </View>

      {campaign.is_active ? (
        <Button
          variant="outline"
          size="sm"
          label={deactivating ? 'Wyłączanie...' : 'Wyłącz'}
          icon={<Power size={16} color={colors.foreground} />}
          disabled={deactivating || disabled}
          onPress={() => onDeactivate(campaign)}
          style={styles.tallButton}
        />
      ) : null}

      <View style={{ gap: 8 }}>
        <Detail label="Kwota" value={formatBonusAmount(campaign.amount)} strong />
        <Detail label="Start" value={new Date(campaign.starts_at).toLocaleString('pl-PL')} />
        <Detail label="Wygaśnięcie" value={new Date(campaign.expires_at).toLocaleString('pl-PL')} />
        <Detail label="Odebrania" value={String(campaign.claim_count)} strong />
      </View>
    </AdminCard>
  );
});

function Detail({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View>
      <Text color="mutedForeground">{label}</Text>
      <Text weight={strong ? '600' : '500'}>{value}</Text>
    </View>
  );
}

const useStyles = createStyles(() => ({
  root: { gap: 24 },
  formCard: { padding: 16, gap: 16 },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tallButton: { height: 44 },
  list: { gap: 12 },
  emptyCard: { padding: 24 },
  campaignCard: { padding: 16, gap: 12 },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
}));
