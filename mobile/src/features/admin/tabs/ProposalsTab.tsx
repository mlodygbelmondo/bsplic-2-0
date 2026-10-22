import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Inbox, XCircle } from 'lucide-react-native';
import { memo, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

import { getErrorMessage } from '@/lib/errors';
import { toast } from '@/lib/toast';
import { createStyles, useTheme } from '@/theme';
import { Button, SectionLoader, StateMessage, Text } from '@/ui';
import {
  acceptProposal,
  ADMIN_PROPOSALS_QUERY_KEY,
  adminProposalsQueryOptions,
  rejectProposal,
} from '../b/api/proposals';
import { categoriesQueryOptions } from '../b/api/categories';
import { ProposalEditorModal } from '../b/components/ProposalEditorModal';
import { ProposalSourceBadges } from '../b/components/ProposalSourceBadges';
import { AdminCard, OfflineNotice } from '../b/components/primitives';
import { useAdminWriteGuard, useQueryErrorToast } from '../b/hooks';
import {
  buildAcceptProposalParams,
  createProposalEditor,
  type ProposalEditor,
  type ProposalRow,
} from '../b/logic/proposal-review';

/** Admin "Propozycje" tab (web `ProposalsTab`). */
export function ProposalsTab() {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const { offline, ensureOnline } = useAdminWriteGuard();
  const proposals = useQuery(adminProposalsQueryOptions());
  const categories = useQuery(categoriesQueryOptions());
  const [editing, setEditing] = useState<ProposalEditor | null>(null);

  useQueryErrorToast(proposals.error, proposals.errorUpdatedAt, (error) =>
    getErrorMessage(error, 'Nie udało się pobrać propozycji'),
  );

  const removeFromList = (proposalId: string) => {
    queryClient.setQueryData<ProposalRow[]>(ADMIN_PROPOSALS_QUERY_KEY, (rows) =>
      rows?.filter((row) => row.id !== proposalId),
    );
    void queryClient.invalidateQueries({ queryKey: ADMIN_PROPOSALS_QUERY_KEY });
  };

  const accept = useMutation({
    mutationFn: acceptProposal,
    onSuccess: (_data, params) => {
      toast.success('Propozycja zaakceptowana');
      // Another proposal's editor opened meanwhile stays open.
      setEditing((current) => (current?.id === params.p_proposal_id ? null : current));
      removeFromList(params.p_proposal_id);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Nie udało się zaakceptować propozycji'));
    },
  });

  const reject = useMutation({
    mutationFn: rejectProposal,
    onSuccess: (_data, proposalId) => {
      toast.info('Propozycja odrzucona');
      removeFromList(proposalId);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Nie udało się odrzucić propozycji'));
    },
  });

  const confirmReject = (proposal: ProposalRow) => {
    if (!ensureOnline()) return;
    Alert.alert(`Czy na pewno chcesz odrzucić propozycję "${proposal.title}"?`, undefined, [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Odrzuć', style: 'destructive', onPress: () => reject.mutate(proposal.id) },
    ]);
  };

  const openEditor = (proposal: ProposalRow) => setEditing(createProposalEditor(proposal));

  const submitEditor = () => {
    if (!editing) return;
    if (accept.isPending) {
      toast.error('Poczekaj, aż zakończy się poprzednia akceptacja');
      return;
    }
    const result = buildAcceptProposalParams(editing);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (!ensureOnline()) return;
    accept.mutate(result.params);
  };

  if (proposals.isPending) {
    return <SectionLoader label="Wczytywanie propozycji..." />;
  }

  if (proposals.isError && !proposals.data) {
    return (
      <StateMessage
        title="Nie udało się pobrać propozycji"
        description={getErrorMessage(proposals.error, '')}
        actionLabel="Spróbuj ponownie"
        onAction={() => void proposals.refetch()}
      />
    );
  }

  const rejectingId = reject.isPending ? reject.variables : null;

  return (
    <View style={styles.list}>
      {offline ? <OfflineNotice /> : null}
      {proposals.data.length === 0 ? <EmptyProposals /> : null}
      {proposals.data.map((proposal) => (
        <ProposalCard
          key={proposal.id}
          proposal={proposal}
          rejecting={rejectingId === proposal.id}
          disabled={offline}
          onAccept={openEditor}
          onReject={confirmReject}
        />
      ))}

      <ProposalEditorModal
        editing={editing}
        categories={categories.data ?? []}
        saving={accept.isPending}
        disabled={offline}
        onChange={setEditing}
        onClose={() => setEditing(null)}
        onSubmit={submitEditor}
      />
    </View>
  );
}

function EmptyProposals() {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Inbox size={32} color={colors.foreground} />
      </View>
      <Text size="base" weight="600" align="center" style={{ marginBottom: 4 }}>
        Brak propozycji
      </Text>
      <Text color="mutedForeground" align="center" style={styles.emptyText}>
        Nowe propozycje od użytkowników pojawią się tutaj i będzie można je zaakceptować lub odrzucić.
      </Text>
    </View>
  );
}

const ProposalCard = memo(function ProposalCard({
  proposal,
  rejecting,
  disabled,
  onAccept,
  onReject,
}: {
  proposal: ProposalRow;
  rejecting: boolean;
  disabled: boolean;
  onAccept: (proposal: ProposalRow) => void;
  onReject: (proposal: ProposalRow) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <AdminCard style={[styles.card, rejecting && styles.cardRejecting]}>
      <View>
        <Text weight="700">{proposal.title}</Text>
        <Text color="mutedForeground" style={styles.meta}>
          Od: {proposal.username} · {proposal.bet_type.toUpperCase()}
        </Text>
        <ProposalSourceBadges source={proposal.proposal_source} metadata={proposal.agent_metadata} />
        <View style={styles.optionChips}>
          {proposal.options.map((option, index) => (
            <View key={`${proposal.id}-${index}`} style={styles.optionChip}>
              <Text size="2xs">
                {option.name} ({Number(option.odds).toFixed(2)})
              </Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.actions}>
        <Button
          variant="gradient"
          size="sm"
          label="Akceptuj"
          accessibilityLabel={`Akceptuj propozycję: ${proposal.title}`}
          icon={<Check size={12} color={colors.primaryForeground} />}
          disabled={rejecting || disabled}
          onPress={() => onAccept(proposal)}
          style={styles.actionButton}
        />
        <Button
          variant="outline"
          size="sm"
          label="Odrzuć"
          accessibilityLabel={`Odrzuć propozycję: ${proposal.title}`}
          icon={
            rejecting ? (
              <ActivityIndicator size="small" color={colors.foreground} />
            ) : (
              <XCircle size={12} color={colors.foreground} />
            )
          }
          disabled={rejecting || disabled}
          onPress={() => onReject(proposal)}
          style={styles.actionButton}
        />
      </View>
    </AdminCard>
  );
});

const useStyles = createStyles(({ colors }) => ({
  list: { gap: 12 },
  card: { padding: 12, gap: 12 },
  cardRejecting: { opacity: 0.5 },
  meta: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  optionChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  optionChip: {
    borderRadius: 999,
    backgroundColor: colors.muted,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  actions: { flexDirection: 'row', gap: 8 },
  actionButton: { flex: 1, height: 44 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 96 },
  emptyIcon: { borderRadius: 999, backgroundColor: colors.muted, padding: 20, marginBottom: 16 },
  emptyText: { maxWidth: 320, lineHeight: 22.75 },
}));
