import { describe, expect, it } from 'vitest';

import { getAdminNavigation, isMobileSlotActive } from './admin-tabs';

describe('getAdminNavigation', () => {
  it('shows only proposals for moderators', () => {
    const nav = getAdminNavigation(false, 'manage');

    expect(nav.activeTab).toBe('proposals');
    expect(nav.activeTabLabel).toBe('Propozycje');
    expect(nav.mobileTabs.map((tab) => tab.label)).toEqual(['Propozycje']);
    expect(nav.moreTabs).toEqual([]);
  });

  it('never lets a moderator open an admin-only tab', () => {
    expect(getAdminNavigation(false, 'create').activeTab).toBe('proposals');
    expect(getAdminNavigation(false, 'more').activeTab).toBe('proposals');
  });

  it('keeps the full admin panel for admins and opens bets first', () => {
    const nav = getAdminNavigation(true, 'manage');

    expect(nav.activeTab).toBe('manage');
    expect(nav.activeTabLabel).toBe('Zarządzaj');
  });

  it('lays out the mobile admin navigation as a five-slot bar with More', () => {
    const nav = getAdminNavigation(true, 'manage');

    expect(nav.mobileTabs.map((tab) => tab.label)).toEqual([
      'Zarządzaj',
      'Propozycje',
      'Utwórz zakład',
      'Bonusy',
      'Więcej',
    ]);
    expect(nav.mobileTabs.map((tab) => tab.shortLabel)).toEqual([
      'Bety',
      'Propozycje',
      'Dodaj',
      'Bonus',
      'Więcej',
    ]);
  });

  it('renders lower-frequency admin sections inside the More area', () => {
    const nav = getAdminNavigation(true, 'more');

    expect(nav.activeTab).toBe('more');
    expect(nav.activeTabLabel).toBe('Więcej');
    expect(nav.moreTabs.map((tab) => tab.label)).toEqual([
      'Dashboard',
      'Kategorie',
      'Eniu',
      'Agent betów',
      'Głosowania',
    ]);
  });
});

describe('isMobileSlotActive', () => {
  it('highlights More while one of its sections is open', () => {
    expect(isMobileSlotActive('more', 'dashboard')).toBe(true);
    expect(isMobileSlotActive('more', 'feature-polls')).toBe(true);
    expect(isMobileSlotActive('more', 'manage')).toBe(false);
  });

  it('highlights a primary slot only for its own tab', () => {
    expect(isMobileSlotActive('create', 'create')).toBe(true);
    expect(isMobileSlotActive('create', 'manage')).toBe(false);
  });
});
