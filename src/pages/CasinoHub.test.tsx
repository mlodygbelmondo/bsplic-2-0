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

    expect(screen.getByTestId('casino-hub-page')).toHaveStyle({
      backgroundImage: "url('/casino/hub-image.png')",
    });
    expect(screen.getByTestId('casino-roulette-card-art')).toHaveStyle({
      backgroundImage: "url('/casino/roulette-button.png')",
    });
    expect(screen.getByTestId('casino-blackjack-card-art')).toHaveStyle({
      backgroundImage: "url('/casino/blackjack-button.png')",
    });
  });
});
