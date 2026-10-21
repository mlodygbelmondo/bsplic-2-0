import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ListPlus, Plus, Power, Trash2, Vote } from 'lucide-react-native';
import { memo, useState, type ReactNode } from 'react';
import { Alert, View } from 'react-native';

import { getErrorMessage } from '@/lib/errors';
import { toast } from '@/lib/toast';
import { createStyles, useTheme, type Colors } from '@/theme';
import { Button, SectionLoader, StateMessage, Text } from '@/ui';
import {
  ADMIN_FEATURE_POLLS_QUERY_KEY,
  adminFeaturePollsQueryOptions,
  createFeaturePoll,
  deactivateFeaturePoll,
} from '../b/api/feature-polls';
import { DateTimeField } from '../b/components/DateTimeField';
import {
  AdminCard,
  CheckboxRow,
  FormField,
  FormLabel,
  Input,
  OfflineNotice,
  Pill,
  ProgressBar,
  TextArea,
} from '../b/components/primitives';
import { useAdminWriteGuard, useQueryErrorToast } from '../b/hooks';
import {
  createDefaultFeaturePollForm,
  getFeaturePollAdminStatus,
  getPercentage,
  validateFeaturePollForm,
  type AdminFeaturePoll,
  type FeaturePollAdminStatus,
  type FeaturePollForm,
} from '../b/logic/feature-polls';

const STATUS_LABELS: Record<FeaturePollAdminStatus, string> = {
  active: 'Aktywna',
  expired: 'Zakończone',
  disabled: 'Wyłączone',
};

// Tailwind emerald-100/800 and amber-100/900.
function statusTone(status: FeaturePollAdminStatus, colors: Colors) {
  if (status === 'active') return { background: '#d1fae5', color: '#065f46' };
  if (status === 'disabled') return { background: '#fef3c7', color: '#78350f' };
  return { background: colors.muted, color: colors.mutedForeground };
}

/** Admin "Głosowania" tab (web `FeaturePollsTab`): create, results and disable. */
export function FeaturePollsTab() {
  const styles = useStyles();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const { offline, ensureOnline } = useAdminWriteGuard();
  const query = useQuery(adminFeaturePollsQueryOptions());
  const [form, setForm] = useState<FeaturePollForm>(() => createDefaultFeaturePollForm());
  const [creating, setCreating] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  useQueryErrorToast(query.error, query.errorUpdatedAt, (error) =>
    getErrorMessage(error, 'Nie udało się pobrać głosowań'),
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: ADMIN_FEATURE_POLLS_QUERY_KEY });
  const update = (patch: Partial<FeaturePollForm>) => setForm((previous) => ({ ...previous, ...patch }));

  const updateOption = (index: number, value: string) =>
    setForm((previous) => ({
      ...previous,
      options: previous.options.map((option, i) => (i === index ? value : option)),
    }));

  const removeOption = (index: number) =>
    setForm((previous) => ({
      ...previous,
      options: previous.options.filter((_, i) => i !== index),
    }));

  const handleCreate = async () => {
    if (creating) return;
    const validationError = validateFeaturePollForm(form);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (!ensureOnline()) return;

    setCreating(true);
    try {
      await createFeaturePoll(form);
      toast.success('Głosowanie utworzone');
      setForm(createDefaultFeaturePollForm());
      await refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Nie udało się utworzyć głosowania'));
    } finally {
      setCreating(false);
    }
  };

  const deactivate = async (pollId: string) => {
    setDeactivatingId(pollId);
    try {
      await deactivateFeaturePoll(pollId);
      toast.success('Głosowanie wyłączone');
      await refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Nie udało się wyłączyć głosowania'));
    } finally {
      setDeactivatingId(null);
    }
  };

  const confirmDeactivate = (poll: AdminFeaturePoll) => {
    if (!ensureOnline()) return;
    Alert.alert(`Czy na pewno chcesz wyłączyć głosowanie "${poll.question}"?`, undefined, [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Wyłącz', style: 'destructive', onPress: () => void deactivate(poll.id) },
    ]);
  };

  const polls = query.data ?? [];

  return (
    <View style={styles.root}>
      {offline ? <OfflineNotice /> : null}

      <AdminCard style={styles.formCard}>
        <View style={styles.formHeader}>
          <Vote size={20} color={colors.primary} />
          <Text size="base" weight="600">
            Nowe głosowanie
          </Text>
        </View>

        <View style={{ gap: 12 }}>
          <Text weight="600">Treści okna głosowania</Text>
          <ToggleBox
            toggleLabel="Pokaż nagłówek"
            checked={form.titleEnabled}
            onToggle={(titleEnabled) => update({ titleEnabled })}
          >
            <FormField label="Nagłówek">
              <Input value={form.title} onChangeText={(title) => update({ title })} />
            </FormField>
          </ToggleBox>
          <ToggleBox
            toggleLabel="Pokaż opis"
            checked={form.descriptionEnabled}
            onToggle={(descriptionEnabled) => update({ descriptionEnabled })}
          >
            <FormField label="Opis">
              <TextArea value={form.description} onChangeText={(description) => update({ description })} />
            </FormField>
          </ToggleBox>
          <ToggleBox
            toggleLabel="Pokaż pytanie"
            checked={form.questionEnabled}
            onToggle={(questionEnabled) => update({ questionEnabled })}
          >
            <FormField label="Pytanie">
              <TextArea value={form.question} onChangeText={(question) => update({ question })} />
            </FormField>
          </ToggleBox>
        </View>

        <View style={{ gap: 8 }}>
          <View style={styles.optionsHeader}>
            <FormLabel>Opcje odpowiedzi</FormLabel>
            <Button
              variant="outline"
              size="sm"
              label="Dodaj"
              icon={<Plus size={16} color={colors.foreground} />}
              onPress={() => update({ options: [...form.options, ''] })}
              style={styles.tallButton}
            />
          </View>
          {form.options.map((option, index) => (
            <View key={index} style={styles.optionRow}>
              <Input
                style={{ flex: 1 }}
                accessibilityLabel={`Opcja ${index + 1}`}
                value={option}
                onChangeText={(value) => updateOption(index, value)}
              />
              <Button
                variant="ghost"
                size="icon"
                accessibilityLabel="Usuń opcję"
                disabled={form.options.length <= 2}
                onPress={() => removeOption(index)}
                style={styles.iconButton}
              >
                <Trash2 size={16} color={colors.foreground} />
              </Button>
            </View>
          ))}
        </View>

        <View style={styles.box}>
          <CheckboxRow
            label="Pozwól na odpowiedź Inne"
            checked={form.allowOther}
            onChange={(allowOther) => update({ allowOther })}
          />
        </View>

        <FormField label="Zakończenie">
          <DateTimeField
            accessibilityLabel="Zakończenie"
            value={form.expiresAt}
            onChange={(expiresAt) => update({ expiresAt })}
          />
        </FormField>

        <Button
          label={creating ? 'Tworzenie...' : 'Utwórz głosowanie'}
          icon={<ListPlus size={16} color={colors.primaryForeground} />}
          disabled={creating || offline}
          onPress={() => void handleCreate()}
          style={styles.tallButton}
        />
      </AdminCard>

      <View style={styles.list}>
        <Text size="base" weight="600">
          Głosowania
        </Text>
        {query.isPending ? (
          <SectionLoader size="sm" />
        ) : query.isError && !query.data ? (
          <StateMessage
            title="Nie udało się pobrać głosowań"
            description={getErrorMessage(query.error, '')}
            actionLabel="Spróbuj ponownie"
            onAction={() => void query.refetch()}
          />
        ) : polls.length === 0 ? (
          <AdminCard style={styles.emptyCard}>
            <Text color="mutedForeground">Brak głosowań.</Text>
          </AdminCard>
        ) : (
          polls.map((poll) => (
            <PollCard
              key={poll.id}
              poll={poll}
              deactivating={deactivatingId === poll.id}
              disabled={offline}
              onDeactivate={confirmDeactivate}
            />
          ))
        )}
      </View>
    </View>
  );
}

function ToggleBox({
  toggleLabel,
  checked,
  onToggle,
  children,
}: {
  toggleLabel: string;
  checked: boolean;
  onToggle: (checked: boolean) => void;
  children: ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.box, { gap: 8 }]}>
      <CheckboxRow label={toggleLabel} checked={checked} onChange={onToggle} />
      {children}
    </View>
  );
}

const PollCard = memo(function PollCard({
  poll,
  deactivating,
  disabled,
  onDeactivate,
}: {
  poll: AdminFeaturePoll;
  deactivating: boolean;
  disabled: boolean;
  onDeactivate: (poll: AdminFeaturePoll) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const status = getFeaturePollAdminStatus(poll);
  const tone = statusTone(status, colors);

  return (
    <AdminCard style={styles.pollCard}>
      <View style={{ gap: 8 }}>
        <View style={styles.titleRow}>
          <Text size="base" weight="600" style={{ flexShrink: 1 }}>
            {poll.question}
          </Text>
          <Pill label={STATUS_LABELS[status]} background={tone.background} color={tone.color} />
        </View>
        <View style={{ gap: 8 }}>
          <View>
            <Text color="mutedForeground">Zakończenie</Text>
            <Text weight="500">{new Date(poll.expires_at).toLocaleString('pl-PL')}</Text>
          </View>
          <View>
            <Text color="mutedForeground">Głosy</Text>
            <Text weight="600">{poll.total_votes}</Text>
          </View>
        </View>
      </View>

      {poll.is_active ? (
        <Button
          variant="outline"
          size="sm"
          label={deactivating ? 'Wyłączanie...' : 'Wyłącz'}
          icon={<Power size={16} color={colors.foreground} />}
          disabled={deactivating || disabled}
          onPress={() => onDeactivate(poll)}
          style={styles.tallButton}
        />
      ) : null}

      <View style={{ gap: 12 }}>
        {poll.options.map((option) => {
          const percentage = getPercentage(option.vote_count, poll.total_votes);
          return (
            <View key={option.id} style={{ gap: 6 }}>
              <View style={styles.resultRow}>
                <Text weight="500" style={{ flexShrink: 1 }}>
                  {option.label}
                </Text>
                <Text color="mutedForeground" tabular>
                  {option.vote_count} / {percentage}%
                </Text>
              </View>
              <ProgressBar value={percentage} />
            </View>
          );
        })}
      </View>

      {poll.other_responses.length > 0 ? (
        <View style={styles.box}>
          <Text weight="600" style={{ marginBottom: 8 }}>
            Odpowiedzi Inne
          </Text>
          <View style={{ gap: 8 }}>
            {poll.other_responses.map((response, index) => (
              <View key={`${response}-${index}`} style={styles.otherResponse}>
                <Text>{response}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </AdminCard>
  );
});

const useStyles = createStyles(({ colors, radius }) => ({
  root: { gap: 24 },
  formCard: { padding: 16, gap: 16 },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  box: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 12 },
  optionsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { width: 44, height: 44 },
  tallButton: { height: 44 },
  list: { gap: 12 },
  emptyCard: { padding: 24 },
  pollCard: { padding: 16, gap: 16 },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  otherResponse: {
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
}));
