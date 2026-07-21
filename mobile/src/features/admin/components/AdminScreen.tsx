import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { BadgePlus, Bot, LayoutDashboard, Lightbulb, ListChecks, PlusCircle, Tag, Vote } from 'lucide-react-native';

import { AppCard, AppText, AccessiblePressable } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAuth } from '@/providers/auth-provider';
import { useNetwork } from '@/providers/network-provider';
import type { AdminTab } from '../constants';
import { BonusCampaignsPanel } from './BonusCampaignsPanel';
import { CategoriesPanel } from './CategoriesPanel';
import { CreateBetPanel } from './CreateBetPanel';
import { DashboardPanel } from './DashboardPanel';
import { EniuPanel } from './EniuPanel';
import { FeaturePollsPanel } from './FeaturePollsPanel';
import { ManageBetsPanel } from './ManageBetsPanel';
import { ProposalsPanel } from './ProposalsPanel';

const TABS = [
  { key: 'manage', label: 'Bety', icon: ListChecks },
  { key: 'proposals', label: 'Propozycje', icon: Lightbulb },
  { key: 'create', label: 'Dodaj', icon: PlusCircle },
  { key: 'dashboard', label: 'Panel', icon: LayoutDashboard },
  { key: 'categories', label: 'Kategorie', icon: Tag },
  { key: 'eniu', label: 'Eniu', icon: Bot },
  { key: 'bonuses', label: 'Bonusy', icon: BadgePlus },
  { key: 'feature-polls', label: 'Głosowania', icon: Vote },
] as const satisfies readonly { key: Exclude<AdminTab, 'more'>; label: string; icon: typeof ListChecks }[];

type ScreenTab = (typeof TABS)[number]['key'];

export function AdminScreen() {
  const { tokens } = useAppTheme();
  const { isAdmin, isModerator, loading } = useAuth();
  const { canPerformWrites, isOnline } = useNetwork();
  const [tab, setTab] = useState<ScreenTab>(isAdmin ? 'manage' : 'proposals');
  if (loading) return null;
  if (!isAdmin && !isModerator) {
    return <View style={[styles.denied, { backgroundColor: tokens.colors.background }]}><AppCard style={styles.deniedCard}><AppText variant="title">Brak dostępu</AppText><AppText tone="muted">Panel jest dostępny wyłącznie dla administratorów i moderatorów.</AppText></AppCard></View>;
  }
  if (!canPerformWrites) {
    return <View style={[styles.denied, { backgroundColor: tokens.colors.background }]}><AppCard style={styles.deniedCard}><AppText variant="title">{isOnline === null ? 'Sprawdzamy połączenie…' : 'Panel admina jest offline'}</AppText><AppText tone="muted">{isOnline === null ? 'Panel uaktywni się, gdy potwierdzimy bezpieczne połączenie z serwerem.' : 'Operacje administracyjne nie są kolejkowane. Połącz się z internetem, aby bezpiecznie zarządzać aplikacją.'}</AppText></AppCard></View>;
  }
  const tabs = isAdmin ? TABS : TABS.filter((item) => item.key === 'proposals');
  const active = tabs.some((item) => item.key === tab) ? tab : 'proposals';
  return (
    <View style={[styles.screen, { backgroundColor: tokens.colors.background }]}>
      <View style={styles.header}><AppText variant="title">{isAdmin ? 'Panel Admina' : 'Panel Moderatora'}</AppText><AppText variant="caption" tone="muted">Pełne zarządzanie BSPLIC</AppText></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroller} contentContainerStyle={styles.tabs}>
        {tabs.map(({ key, label, icon: Icon }) => {
          const selected = active === key;
          return <AccessiblePressable key={key} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => setTab(key)} style={[styles.tab, { backgroundColor: selected ? tokens.colors.primary : tokens.colors.card, borderColor: selected ? tokens.colors.primary : tokens.colors.border }]}><Icon size={16} color={selected ? tokens.colors.primaryForeground : tokens.colors.mutedForeground} /><AppText variant="label" style={{ color: selected ? tokens.colors.primaryForeground : tokens.colors.foreground }}>{label}</AppText></AccessiblePressable>;
        })}
      </ScrollView>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {active === 'dashboard' ? <DashboardPanel /> : null}
        {active === 'manage' ? <ManageBetsPanel /> : null}
        {active === 'create' ? <CreateBetPanel /> : null}
        {active === 'proposals' ? <ProposalsPanel /> : null}
        {active === 'categories' ? <CategoriesPanel /> : null}
        {active === 'eniu' ? <EniuPanel /> : null}
        {active === 'bonuses' ? <BonusCampaignsPanel /> : null}
        {active === 'feature-polls' ? <FeaturePollsPanel /> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, header: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, gap: 2 },
  tabScroller: { flexGrow: 0, maxHeight: 64 },
  tabs: { alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 8 }, tab: { height: 44, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 7 },
  content: { padding: 16, paddingBottom: 120 }, denied: { flex: 1, justifyContent: 'center', padding: 24 }, deniedCard: { gap: 8 },
});
