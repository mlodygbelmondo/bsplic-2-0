import { Redirect } from 'expo-router';
import { useRef, useState } from 'react';
import { View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated';

import { useAuthStore } from '@/features/auth/auth-store';
import { AppHeader } from '@/features/shell/AppHeader';
import { alpha, createStyles } from '@/theme';
import { getAdminNavigation } from './admin-tabs';
import { AdminBottomNav } from './components/AdminBottomNav';
import { AdminChromeContext, AdminTabScroll, type AdminChrome } from './components/AdminChrome';
import { ConfettiOverlay } from './components/Confetti';
import { MoreSections } from './components/MoreSections';
import type { AdminTab } from './constants';
import { getNextScrollChromeState, type ScrollChromeState } from './scroll-chrome';
import { AgentRunsTab } from './tabs/AgentRunsTab';
import { BonusCampaignsTab } from './tabs/BonusCampaignsTab';
import { CategoriesTab } from './tabs/CategoriesTab';
import { CreateBetTab } from './tabs/CreateBetTab';
import { DashboardTab } from './tabs/DashboardTab';
import { EniuBotTab } from './tabs/EniuBotTab';
import { FeaturePollsTab } from './tabs/FeaturePollsTab';
import { ManageBetsTab } from './tabs/ManageBetsTab';
import { ProposalsTab } from './tabs/ProposalsTab';

const NAV_TRANSITION = { duration: 200, easing: Easing.out(Easing.ease) };

/**
 * Web `AdminLayout` at phone size: role gate, tab state, the five-slot
 * bottom bar with "Więcej", hide-on-scroll. Only the active tab is mounted,
 * so only it renders and fetches.
 */
export function AdminScreen() {
  const styles = useStyles();
  // Roles are known once auth settled and the profile (with `user_roles`) loaded
  // or came from the identity cache; rendering nothing until then avoids
  // bouncing a real admin back home.
  const rolesLoading = useAuthStore((s) => s.loading || s.profileStatus === 'loading');
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const isModerator = useAuthStore((s) => s.isModerator);
  const [tab, setTab] = useState<AdminTab>('manage');

  const navHidden = useSharedValue(0);
  const chromeState = useRef<ScrollChromeState | undefined>(undefined);

  const showNav = (hidden: boolean) => {
    navHidden.set(withTiming(hidden ? 1 : 0, NAV_TRANSITION));
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const previous = chromeState.current;
    const next = getNextScrollChromeState(previous, {
      scrollTop: contentOffset.y,
      scrollHeight: contentSize.height,
      clientHeight: layoutMeasurement.height,
    });
    chromeState.current = next;
    if ((previous?.hidden ?? false) !== next.hidden) showNav(next.hidden);
  };

  const selectTab = (next: AdminTab) => {
    // Each tab mounts its own scroll container at the top; start with the bar shown.
    chromeState.current = undefined;
    showNav(false);
    setTab(next);
  };

  if (rolesLoading) return null;
  if (!isAdmin && !isModerator) return <Redirect href="/" />;

  const { activeTab, activeTabLabel, mobileTabs, moreTabs } = getAdminNavigation(isAdmin, tab);
  const chrome: AdminChrome = { title: activeTabLabel, onScroll, navHidden };

  return (
    <View style={styles.root}>
      <AppHeader back />
      <AdminChromeContext value={chrome}>
        <View style={styles.body}>
          <ActiveTab key={activeTab} tab={activeTab} moreTabs={moreTabs} onSelect={selectTab} />
        </View>
        <AdminBottomNav tabs={mobileTabs} activeTab={activeTab} hidden={navHidden} onSelect={selectTab} />
      </AdminChromeContext>
      <ConfettiOverlay />
    </View>
  );
}

function ActiveTab({
  tab,
  moreTabs,
  onSelect,
}: {
  tab: AdminTab;
  moreTabs: ReturnType<typeof getAdminNavigation>['moreTabs'];
  onSelect: (tab: AdminTab) => void;
}) {
  switch (tab) {
    // Part A tabs own their scroll container (list, sticky submit bar, pull to refresh).
    case 'manage':
      return <ManageBetsTab />;
    case 'create':
      return <CreateBetTab />;
    case 'dashboard':
      return <DashboardTab />;
    case 'more':
      return (
        <AdminTabScroll>
          <MoreSections tabs={moreTabs} onSelect={onSelect} />
        </AdminTabScroll>
      );
    default:
      return <AdminTabScroll>{renderPartBTab(tab)}</AdminTabScroll>;
  }
}

function renderPartBTab(tab: AdminTab) {
  switch (tab) {
    case 'proposals':
      return <ProposalsTab />;
    case 'categories':
      return <CategoriesTab />;
    case 'eniu':
      return <EniuBotTab />;
    case 'agent':
      return <AgentRunsTab />;
    case 'bonuses':
      return <BonusCampaignsTab />;
    case 'feature-polls':
      return <FeaturePollsTab />;
    default:
      return null;
  }
}

const useStyles = createStyles(({ colors }) => ({
  // Web `bg-muted/30` over the body background.
  root: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, backgroundColor: alpha(colors.muted, 0.3) },
}));
