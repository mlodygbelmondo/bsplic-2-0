import { render, screen, within } from '@testing-library/react';
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

  it('lays out the mobile admin navigation in equal tab columns', () => {
    mockIsAdmin = true;

    renderAdminLayout();

    const mobileNav = screen.getByRole('navigation', {
      name: 'Nawigacja admina',
    });
    const tabGrid = mobileNav.firstElementChild;

    expect(tabGrid).toHaveStyle({
      gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
    });
    expect(within(mobileNav).getByLabelText('Utwórz zakład')).toHaveTextContent(
      'Dodaj',
    );
  });
});
