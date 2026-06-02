import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Index from './Index';

const mocks = vi.hoisted(() => ({
  authState: {
    user: null as { id: string } | null,
    loading: false,
  },
  authenticatedHomeRender: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mocks.authState,
}));

vi.mock('@/components/LoginPage', () => ({
  LoginPage: () => <div>Login screen</div>,
}));

vi.mock('@/features/home/components/AuthenticatedHome', () => ({
  default: () => {
    mocks.authenticatedHomeRender();
    return <div>Authenticated home</div>;
  },
}));

describe('Index', () => {
  beforeEach(() => {
    mocks.authState.user = null;
    mocks.authState.loading = false;
    mocks.authenticatedHomeRender.mockClear();
  });

  it('keeps authenticated home work out of the logged-out root screen', () => {
    render(<Index />);

    expect(screen.getByText('Login screen')).toBeInTheDocument();
    expect(mocks.authenticatedHomeRender).not.toHaveBeenCalled();
  });
});
