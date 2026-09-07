import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { coupon } from './testing/fixtures';
import { useReplayHistory } from './useReplayHistory';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), abort: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc } }));
const clients: QueryClient[] = [];
function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  clients.push(client);
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.abort.mockResolvedValue({ data: [coupon()], error: null });
  mocks.rpc.mockReturnValue({ abortSignal: mocks.abort });
});
afterEach(() => { cleanup(); clients.splice(0).forEach((client) => client.clear()); });

describe('Replay read-only history query', () => {
  it('requests exactly one bounded snapshot for the authenticated identity', async () => {
    const view = renderHook(() => useReplayHistory('user-1'), { wrapper: wrapper() });
    await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('get_user_coupon_history', { p_user_id: 'user-1', p_limit: 201, p_offset: 0 });
    expect(mocks.abort).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(view.result.current.data?.coupons).toHaveLength(1);
  });
  it('does not fetch without an authenticated identity', () => {
    const view = renderHook(() => useReplayHistory(null), { wrapper: wrapper() });
    expect(view.result.current.fetchStatus).toBe('idle');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('does not reuse the previous account data during an identity change', async () => {
    const view = renderHook(({ id }) => useReplayHistory(id), { initialProps: { id: 'first' }, wrapper: wrapper() });
    await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
    mocks.abort.mockImplementation(() => new Promise(() => {}));
    view.rerender({ id: 'second' });
    expect(view.result.current.data).toBeUndefined();
    expect(mocks.rpc).toHaveBeenLastCalledWith('get_user_coupon_history', expect.objectContaining({ p_user_id: 'second' }));
  });
  it('aborts the in-flight request on unmount', () => {
    mocks.abort.mockImplementation(() => new Promise(() => {}));
    const view = renderHook(() => useReplayHistory('user-1'), { wrapper: wrapper() });
    const signal = mocks.abort.mock.calls[0][0] as AbortSignal;
    view.unmount();
    expect(signal.aborted).toBe(true);
  });
  it('surfaces server failure after one retry, rather than displaying an empty success', async () => {
    mocks.abort.mockResolvedValue({ data: null, error: new Error('offline') });
    const view = renderHook(() => useReplayHistory('user-1'), { wrapper: wrapper() });
    await waitFor(() => expect(view.result.current.isError).toBe(true));
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(view.result.current.data).toBeUndefined();
  });
});
