import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import CasinoRoulettePage from './CasinoRoulettePage';

const useAuthMock = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('@/features/casino/components/CasinoLobby', () => ({
  CasinoLobby: () => <div data-testid="casino-lobby-stub" />,
}));

describe('CasinoRoulettePage', () => {
  it('uses the roulette background art on the page shell', () => {
    useAuthMock.mockReturnValue({
      user: { id: 'user-1' },
      profile: { balance: 100 },
      refreshProfile: vi.fn(),
    });

    const { container } = render(<CasinoRoulettePage />);

    expect(screen.getByTestId('casino-roulette-shell')).toHaveStyle({
      '--casino-bg-desktop': "url('/casino/roulette-background.webp')",
      '--casino-bg-mobile': "url('/casino/roulette-mobile-background.webp')",
    });
    expect(
      container.querySelector('[data-testid="casino-roulette-shell"]'),
    ).toBeTruthy();
  });

  it('keeps the mobile roulette content close to the top chrome', () => {
    useAuthMock.mockReturnValue({
      user: { id: 'user-1' },
      profile: { balance: 100 },
      refreshProfile: vi.fn(),
    });

    const { container } = render(<CasinoRoulettePage />);
    const content = container.querySelector('.max-w-\\[1800px\\]');

    expect(content).toHaveClass('pt-1.5', 'md:p-6');
  });
});
