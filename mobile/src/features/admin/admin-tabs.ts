import type { AdminTab } from './constants';

/** Port of the web `AdminLayout` tab table (labels are the source's own). */
export interface AdminTabConfig {
  key: AdminTab;
  label: string;
  shortLabel: string;
}

export const ADMIN_TABS: AdminTabConfig[] = [
  { key: 'dashboard', label: 'Dashboard', shortLabel: 'Panel' },
  { key: 'manage', label: 'Zarządzaj', shortLabel: 'Bety' },
  { key: 'create', label: 'Utwórz zakład', shortLabel: 'Dodaj' },
  { key: 'proposals', label: 'Propozycje', shortLabel: 'Propozycje' },
  { key: 'categories', label: 'Kategorie', shortLabel: 'Kat.' },
  { key: 'eniu', label: 'Eniu', shortLabel: 'Eniu' },
  { key: 'agent', label: 'Agent betów', shortLabel: 'Agent' },
  { key: 'bonuses', label: 'Bonusy', shortLabel: 'Bonus' },
  { key: 'feature-polls', label: 'Głosowania', shortLabel: 'Głosy' },
];

export const MORE_TAB: AdminTabConfig = {
  key: 'more',
  label: 'Więcej',
  shortLabel: 'Więcej',
};

export const MOBILE_PRIMARY_TAB_KEYS: AdminTab[] = [
  'manage',
  'proposals',
  'create',
  'bonuses',
  'more',
];

export const MOBILE_MORE_TAB_KEYS: AdminTab[] = [
  'dashboard',
  'categories',
  'eniu',
  'agent',
  'feature-polls',
];

export interface AdminNavigation {
  activeTab: AdminTab;
  activeTabLabel: string;
  /** Slots of the mobile bottom bar (five for admins, `availableTabs` for moderators). */
  mobileTabs: AdminTabConfig[];
  /** Cards of the "Więcej" section. */
  moreTabs: AdminTabConfig[];
}

const isPresent = (tab: AdminTabConfig | undefined): tab is AdminTabConfig =>
  tab !== undefined;

/**
 * Role gating and tab derivation from `AdminLayout`: admins get every tab
 * (default `manage`), moderators only `proposals`. A requested tab outside the
 * role falls back to the default; admins keep `more`.
 */
export function getAdminNavigation(
  isAdmin: boolean,
  requestedTab: AdminTab,
): AdminNavigation {
  const availableTabs = isAdmin
    ? ADMIN_TABS
    : ADMIN_TABS.filter((tab) => tab.key === 'proposals');
  const defaultTab: AdminTab = isAdmin ? 'manage' : 'proposals';
  const activeTab = availableTabs.some((tab) => tab.key === requestedTab)
    ? requestedTab
    : isAdmin && requestedTab === 'more'
      ? requestedTab
      : defaultTab;
  const activeTabLabel =
    activeTab === 'more'
      ? MORE_TAB.label
      : (availableTabs.find((tab) => tab.key === activeTab)?.label ?? '');
  const findTab = (key: AdminTab) =>
    availableTabs.find((tab) => tab.key === key);
  const mobileTabs = isAdmin
    ? MOBILE_PRIMARY_TAB_KEYS.map((key) =>
        key === 'more' ? MORE_TAB : findTab(key),
      ).filter(isPresent)
    : availableTabs;
  const moreTabs = MOBILE_MORE_TAB_KEYS.map(findTab).filter(isPresent);

  return { activeTab, activeTabLabel, mobileTabs, moreTabs };
}

/** The "Więcej" slot stays highlighted while any of its sections is open. */
export function isMobileSlotActive(slot: AdminTab, activeTab: AdminTab) {
  if (slot === 'more') {
    return activeTab === 'more' || MOBILE_MORE_TAB_KEYS.includes(activeTab);
  }
  return slot === activeTab;
}
