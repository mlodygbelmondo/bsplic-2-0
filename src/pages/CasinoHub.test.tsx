import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import CasinoHub from './CasinoHub';

describe('CasinoHub', () => {
  it('links to both slot games', () => {
    render(
      <MemoryRouter>
        <CasinoHub />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /Midnight Bandit/ })).toHaveAttribute('href', '/casino/slots/bandit');
    expect(screen.getByRole('link', { name: /Candy Cascade/ })).toHaveAttribute('href', '/casino/slots/candy');
  });
});
