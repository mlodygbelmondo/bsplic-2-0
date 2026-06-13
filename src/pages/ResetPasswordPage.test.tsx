import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ResetPasswordPage from './ResetPasswordPage';

const updateUserMock = vi.fn();
const unsubscribeMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({
        data: {
          subscription: {
            unsubscribe: unsubscribeMock,
          },
        },
      })),
      updateUser: (...args: unknown[]) => updateUserMock(...args),
    },
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = '#type=recovery';
  });

  it('shows inline password confirmation feedback before submit', () => {
    render(
      <MemoryRouter>
        <ResetPasswordPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Nowe hasło'), {
      target: { value: 'secret1' },
    });
    fireEvent.change(screen.getByLabelText('Potwierdź hasło'), {
      target: { value: 'secret2' },
    });

    expect(screen.getByText('Hasła nie są takie same')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zmień hasło' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Potwierdź hasło'), {
      target: { value: 'secret1' },
    });

    expect(screen.getByText('Hasła są zgodne')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zmień hasło' })).toBeEnabled();
  });
});
