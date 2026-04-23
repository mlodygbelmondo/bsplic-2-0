import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CasinoPage from './CasinoPage';

const useAuthMock = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('@/components/LoginPage', () => ({
  LoginPage: () => <div>LoginPage</div>,
}));

vi.mock('@/components/Navbar', () => ({
  Navbar: () => <div>Navbar</div>,
}));

vi.mock('@/features/casino/components/CasinoLobby', () => ({
  CasinoLobby: ({ balance }: { balance: number }) => (
    <div>CasinoLobby balance={balance.toFixed(2)}</div>
  ),
}));

describe('CasinoPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps loading state until profile is available for logged-in user', () => {
    useAuthMock.mockReturnValue({
      user: { id: 'user-1' },
      profile: null,
      loading: false,
      refreshProfile: vi.fn(),
    });

    const { container } = render(<CasinoPage />);

    expect(screen.queryByText(/CasinoLobby balance=/)).not.toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders lobby with real profile balance once profile is loaded', () => {
    useAuthMock.mockReturnValue({
      user: { id: 'user-1' },
      profile: { balance: 250.5 },
      loading: false,
      refreshProfile: vi.fn(),
    });

    render(<CasinoPage />);

    expect(screen.getByText('CasinoLobby balance=250.50')).toBeInTheDocument();
  });
});
