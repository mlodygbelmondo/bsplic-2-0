import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makePostFeedItem } from '@/features/social/test-utils/socialFeedFactories';
import { useSocialRealtimeFeed } from './useSocialRealtimeFeed';

const mocks = vi.hoisted(() => ({
  callback: (_payload: unknown) => {},
  removeChannel: vi.fn(),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    channel: () => ({
      on: (
        _event: string,
        _filter: unknown,
        callback: typeof mocks.callback,
      ) => {
        mocks.callback = callback;
        return { subscribe: () => ({}) };
      },
    }),
    removeChannel: mocks.removeChannel,
  },
}));

function emit(
  sourceTable = 'social_comments',
  operation = 'INSERT',
  itemId = 'post-1',
) {
  mocks.callback({
    eventType: 'INSERT',
    new: {
      target_type: 'post',
      target_id: itemId,
      source_table: sourceTable,
      operation,
    },
    old: {},
  });
}

function setup() {
  const refreshFeedItem = vi.fn().mockResolvedValue(undefined);
  const loadComments = vi.fn().mockResolvedValue(undefined);
  const hook = renderHook(() =>
    useSocialRealtimeFeed({
      feedItems: [makePostFeedItem()],
      commentsLoadedMap: { 'post-1': true },
      refreshFeedItem,
      loadComments,
    }),
  );
  return { ...hook, refreshFeedItem, loadComments };
}

describe('useSocialRealtimeFeed request batching', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces a burst into one item read and one comments read', async () => {
    const { refreshFeedItem, loadComments } = setup();
    act(() => {
      for (let i = 0; i < 20; i++) emit();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(refreshFeedItem).toHaveBeenCalledTimes(1);
    expect(loadComments).toHaveBeenCalledTimes(1);
  });

  it('preserves insert permission when later events arrive for a new item', async () => {
    const { refreshFeedItem, loadComments } = setup();
    act(() => {
      emit('social_posts', 'INSERT', 'post-new');
      emit('social_reactions', 'INSERT', 'post-new');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(refreshFeedItem).toHaveBeenCalledExactlyOnceWith(
      'post',
      'post-new',
      { allowInsert: true },
    );
    expect(loadComments).not.toHaveBeenCalled();
  });

  it('does not reload unrelated items or closed comments', async () => {
    const { refreshFeedItem, loadComments } = setup();
    act(() => {
      emit('social_reactions', 'INSERT', 'unloaded');
      emit('social_posts', 'UPDATE');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(refreshFeedItem).toHaveBeenCalledExactlyOnceWith('post', 'post-1', {
      allowInsert: false,
    });
    expect(loadComments).not.toHaveBeenCalled();
  });

  it('cancels queued reads on unmount', async () => {
    const { unmount, refreshFeedItem } = setup();
    act(() => emit());
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(refreshFeedItem).not.toHaveBeenCalled();
    expect(mocks.removeChannel).toHaveBeenCalledTimes(1);
  });

  it('queues one follow-up instead of overlapping requests for the same item', async () => {
    const { refreshFeedItem } = setup();
    let finish!: () => void;
    refreshFeedItem.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    act(() => emit());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    act(() => {
      for (let i = 0; i < 20; i++) emit();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(refreshFeedItem).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(refreshFeedItem).toHaveBeenCalledTimes(2);
  });
});
