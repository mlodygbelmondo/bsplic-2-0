import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminLayout from './AdminLayout';

let mockIsAdmin = false;
let mockIsModerator = false;
let mockLoading = false;

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isAdmin: mockIsAdmin,
    isModerator: mockIsModerator,
    loading: mockLoading,
  }),
}));

vi.mock('@/components/Navbar', () => ({
  Navbar: () => <div data-testid="navbar" />,
}));

vi.mock('./DashboardTab', () => ({
  default: () => <div data-testid="dashboard-tab" />,
}));

vi.mock('./CreateBetTab', () => ({
  default: () => <div data-testid="create-tab" />,
}));

vi.mock('./ManageBetsTab', () => ({
  default: () => <div data-testid="manage-tab" />,
}));

vi.mock('./ProposalsTab', () => ({
  default: () => <div data-testid="proposals-tab" />,
}));

vi.mock('./CategoriesTab', () => ({
  default: () => <div data-testid="categories-tab" />,
}));

vi.mock('./EniuBotTab', () => ({
  default: () => <div data-testid="eniu-tab" />,
}));

vi.mock('./BonusCampaignsTab', () => ({
  default: () => <div data-testid="bonuses-tab" />,
}));

vi.mock('./FeaturePollsTab', () => ({
  default: () => <div data-testid="feature-polls-tab" />,
}));

function renderAdminLayout() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/" element={<div>Home</div>} />
        <Route path="/admin" element={<AdminLayout />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminLayout', () => {
  beforeEach(() => {
    mockIsAdmin = false;
    mockIsModerator = false;
    mockLoading = false;
  });

  it('shows only proposals for moderators', async () => {
    mockIsModerator = true;

    renderAdminLayout();

    expect(screen.getByText('Panel Moderatora')).toBeInTheDocument();
    expect(screen.getAllByText('Propozycje').length).toBeGreaterThan(0);
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Zarządzaj')).not.toBeInTheDocument();
    expect(screen.queryByText('Utwórz zakład')).not.toBeInTheDocument();
    expect(await screen.findByTestId('proposals-tab')).toBeInTheDocument();
  });

  it('keeps the full admin panel for admins', async () => {
    mockIsAdmin = true;

    renderAdminLayout();

    expect(screen.getByText('Panel Admina')).toBeInTheDocument();
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Zarządzaj').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Utwórz zakład').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Propozycje').length).toBeGreaterThan(0);
    expect(await screen.findByTestId('dashboard-tab')).toBeInTheDocument();
  });

  it('lays out the mobile admin navigation as a five-slot bar with More', () => {
    mockIsAdmin = true;

    renderAdminLayout();

    const mobileNav = screen.getByRole('navigation', {
      name: 'Nawigacja admina',
    });
    const tabGrid = mobileNav.firstElementChild;

    expect(tabGrid).toHaveStyle({
      gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
    });

    const navButtons = within(mobileNav).getAllByRole('button');
    expect(
      navButtons.map((button) => button.getAttribute('aria-label')),
    ).toEqual([
      'Zarządzaj',
      'Propozycje',
      'Utwórz zakład',
      'Bonusy',
      'Więcej',
    ]);
    expect(navButtons[2]).toHaveClass('-top-4');
  });

  it('renders lower-frequency admin sections inside the mobile More area', async () => {
    mockIsAdmin = true;

    renderAdminLayout();

    const mobileNav = screen.getByRole('navigation', {
      name: 'Nawigacja admina',
    });
    fireEvent.click(
      within(mobileNav).getByRole('button', { name: 'Więcej' }),
    );

    expect(screen.getByText('Pozostałe sekcje')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Dashboard' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Kategorie' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Eniu' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Głosowania' }).length).toBeGreaterThan(0);
  });
});
