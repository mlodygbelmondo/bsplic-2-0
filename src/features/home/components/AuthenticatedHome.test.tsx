import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AuthenticatedHome from './AuthenticatedHome';

const homeShellMock = vi.hoisted(() =>
  vi.fn(({ onMobileChromeHiddenChange }) => (
    <button
      type="button"
      onClick={() => onMobileChromeHiddenChange?.(true)}
    >
      hide chrome
    </button>
  )),
);
const navbarMock = vi.hoisted(() => vi.fn(() => <div data-testid="navbar" />));

vi.mock('@/components/Navbar', () => ({
  Navbar: (props: { mobileBottomNavHidden?: boolean }) => navbarMock(props),
}));

vi.mock('@/components/ProposeBetModal', () => ({
  ProposeBetModal: () => <div data-testid="propose-modal" />,
}));

vi.mock('@/features/home/hooks/useCategories', () => ({
  useCategories: () => ({
    categories: [],
    categoryMap: {},
    loading: false,
  }),
}));

vi.mock('@/features/home/layout/HomeShell', () => ({
  HomeShell: (props: {
    onMobileChromeHiddenChange?: (hidden: boolean) => void;
  }) => homeShellMock(props),
}));

describe('AuthenticatedHome mobile chrome state', () => {
  afterEach(() => {
    homeShellMock.mockClear();
    navbarMock.mockClear();
  });

  it('passes the hidden mobile chrome state to the navbar', () => {
    const { getByRole } = render(<AuthenticatedHome />);

    expect(navbarMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ mobileBottomNavHidden: false }),
    );

    act(() => {
      getByRole('button', { name: 'hide chrome' }).click();
    });

    expect(navbarMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ mobileBottomNavHidden: true }),
    );
  });
});
