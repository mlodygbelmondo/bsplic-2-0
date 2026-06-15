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

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'light',
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

  it('keeps the full admin panel for admins and opens bets first', async () => {
    mockIsAdmin = true;

    renderAdminLayout();

    expect(screen.getByText('Panel Admina')).toBeInTheDocument();
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Zarządzaj').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Utwórz zakład').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Propozycje').length).toBeGreaterThan(0);
    expect(await screen.findByTestId('manage-tab')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-tab')).not.toBeInTheDocument();
  });

  it('lays out the mobile admin navigation as a five-slot bar with More', () => {
    mockIsAdmin = true;

    renderAdminLayout();

    const mobileNav = screen.getByRole('navigation', {
      name: 'Nawigacja admina',
    });
    const tabGrid = mobileNav.firstElementChild?.firstElementChild;

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
    expect(navButtons[2]).toHaveClass('min-h-[50px]');
  });

  it('uses centered, accessible mobile admin navigation targets', () => {
    mockIsAdmin = true;

    renderAdminLayout();

    const mobileNav = screen.getByRole('navigation', {
      name: 'Nawigacja admina',
    });
    const tabGrid = mobileNav.firstElementChild?.firstElementChild;
    const navButtons = within(mobileNav).getAllByRole('button');

    expect(tabGrid).toHaveClass('px-2', 'rounded-t-lg');
    navButtons.forEach((button) => {
      expect(button).toHaveClass('items-center', 'justify-center');
    });
    expect(navButtons[0]).toHaveClass(
      'min-h-[54px]',
      'gap-1',
      'rounded-xl',
      'text-[11px]',
      'font-black',
    );
    expect(navButtons[2]).toHaveClass('relative', 'min-h-[50px]');
    expect(navButtons[2]).not.toHaveClass('-top-5', 'min-h-[58px]');
    expect(navButtons[2].firstElementChild).toHaveClass(
      'absolute',
      '-top-5',
      'h-[58px]',
      'w-[58px]',
    );
    expect(navButtons[2].firstElementChild).not.toHaveClass('h-[62px]', 'w-[62px]');
    expect(navButtons[2].firstElementChild?.firstElementChild).toHaveClass('h-7', 'w-7');
    expect(navButtons[0].firstElementChild).toHaveClass('h-5', 'w-5');
    expect(within(navButtons[0]).getByText('Bety')).toHaveClass('leading-none');
    expect(within(navButtons[1]).getByText('Propozycje')).toHaveClass('leading-none');
  });

  it('uses the same mobile glass surface for admin navigation', () => {
    mockIsAdmin = true;

    renderAdminLayout();

    const mobileNav = screen.getByRole('navigation', {
      name: 'Nawigacja admina',
    });

    expect(mobileNav.firstElementChild).toHaveClass('bg-white', 'rounded-t-lg');
    expect(mobileNav.firstElementChild?.firstElementChild).toHaveClass(
      'bg-white/72',
      'backdrop-blur-xl',
      'rounded-t-lg',
    );
    expect(within(mobileNav).getByRole('button', { name: 'Zarządzaj' })).not.toHaveClass(
      'bg-primary/10',
    );
  });

  it('hides the mobile admin navigation on deliberate downward scroll', () => {
    mockIsAdmin = true;

    renderAdminLayout();

    const mobileNav = screen.getByRole('navigation', {
      name: 'Nawigacja admina',
    });
    const scrollContainer = screen.getByTestId('admin-scroll-container');

    Object.defineProperties(scrollContainer, {
      scrollTop: { configurable: true, value: 120 },
      scrollHeight: { configurable: true, value: 900 },
      clientHeight: { configurable: true, value: 500 },
    });

    fireEvent.scroll(scrollContainer, {
      currentTarget: {
        scrollTop: 120,
        scrollHeight: 900,
        clientHeight: 500,
      },
    });

    expect(mobileNav).toHaveClass('translate-y-full', 'opacity-0');
  });

  it('does not reserve a fixed gray spacer above the mobile admin navigation', () => {
    mockIsAdmin = true;

    renderAdminLayout();

    const main = screen.getByRole('main');

    expect(main).not.toHaveClass('pb-[calc(5rem+env(safe-area-inset-bottom))]');
    expect(main.firstElementChild).toHaveClass(
      'pb-[calc(5rem+env(safe-area-inset-bottom))]',
      'md:pb-0',
    );
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
