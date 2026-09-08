import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import CasinoHub from './CasinoHub';

describe('CasinoHub', () => {
  it('uses casino artwork as the hub and game card backgrounds', () => {
    render(
      <MemoryRouter>
        <CasinoHub />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /Midnight Bandit/ })).toHaveAttribute('href', '/casino/slots/bandit');
    expect(screen.getByRole('link', { name: /Candy Cascade/ })).toHaveAttribute('href', '/casino/slots/candy');
    expect(screen.getByTestId('casino-hub-page')).toHaveStyle({
      '--casino-bg-desktop': "url('/casino/hub-image.webp')",
      '--casino-bg-mobile': "url('/casino/hub-mobile-background.webp')",
    });
    expect(screen.getByTestId('casino-roulette-card-art')).toHaveAttribute('src', '/casino/roulette-cover.webp');
    expect(screen.getByTestId('casino-blackjack-card-art')).toHaveAttribute('src', '/casino/blackjack-cover.webp');
  });
});
