import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const sonnerToasterMock = vi.hoisted(() => vi.fn(() => null));

vi.mock('sonner', () => ({
  Toaster: sonnerToasterMock,
  toast: {},
}));

import { Toaster } from './sonner';

describe('Toaster', () => {
  it('defaults to mobile-safe centered positioning', () => {
    render(<Toaster />);

    const props = sonnerToasterMock.mock.calls[0][0];
    expect(props.position).toBe('top-center');
    expect(props.mobileOffset).toEqual({
      top: 'calc(1rem + env(safe-area-inset-top, 0px))',
      right: 16,
      bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
      left: 16,
    });
    expect(props.offset).toEqual({
      top: 'calc(4.75rem + env(safe-area-inset-top, 0px))',
      right: 16,
      bottom: 16,
      left: 16,
    });
  });
});
