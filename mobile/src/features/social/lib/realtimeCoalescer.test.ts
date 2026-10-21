import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRealtimeCoalescer } from './realtimeCoalescer';

function row(sourceTable = 'social_comments', operation = 'INSERT', itemId = 'post-1') {
  return { target_type: 'post', target_id: itemId, source_table: sourceTable, operation };
}

function setup() {
  const refreshItem = vi.fn().mockResolvedValue(undefined);
  const reloadComments = vi.fn().mockResolvedValue(undefined);
  const coalescer = createRealtimeCoalescer({
    isLoaded: (_type, id) => id === 'post-1',
    areCommentsLoaded: (_type, id) => id === 'post-1',
    refreshItem,
    reloadComments,
  });
  return { coalescer, refreshItem, reloadComments };
}

describe('realtime coalescer (web useSocialRealtimeFeed batching)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces a burst into one item read and one comments read', async () => {
    const { coalescer, refreshItem, reloadComments } = setup();
    for (let i = 0; i < 20; i++) coalescer.push(row());
    await vi.advanceTimersByTimeAsync(300);
    expect(refreshItem).toHaveBeenCalledTimes(1);
    expect(reloadComments).toHaveBeenCalledTimes(1);
  });

  it('preserves insert permission when later events arrive for a new item', async () => {
    const { coalescer, refreshItem, reloadComments } = setup();
    coalescer.push(row('social_posts', 'INSERT', 'post-new'));
    coalescer.push(row('social_reactions', 'INSERT', 'post-new'));
    await vi.advanceTimersByTimeAsync(300);
    expect(refreshItem).toHaveBeenCalledExactlyOnceWith('post', 'post-new', { allowInsert: true });
    expect(reloadComments).not.toHaveBeenCalled();
  });

  it('does not reload unrelated items or closed comments', async () => {
    const { coalescer, refreshItem, reloadComments } = setup();
    coalescer.push(row('social_reactions', 'INSERT', 'unloaded'));
    coalescer.push(row('social_posts', 'UPDATE'));
    await vi.advanceTimersByTimeAsync(300);
    expect(refreshItem).toHaveBeenCalledExactlyOnceWith('post', 'post-1', { allowInsert: false });
    expect(reloadComments).not.toHaveBeenCalled();
  });

  it('ignores rows without a valid feed target', async () => {
    const { coalescer, refreshItem } = setup();
    coalescer.push({ target_type: 'story', target_id: 'post-1', source_table: 'social_posts', operation: 'INSERT' });
    coalescer.push({ target_type: 'post', target_id: '', source_table: 'social_posts', operation: 'INSERT' });
    await vi.advanceTimersByTimeAsync(300);
    expect(refreshItem).not.toHaveBeenCalled();
  });

  it('cancels queued reads on dispose', async () => {
    const { coalescer, refreshItem } = setup();
    coalescer.push(row());
    coalescer.dispose();
    await vi.advanceTimersByTimeAsync(300);
    expect(refreshItem).not.toHaveBeenCalled();
  });

  it('queues one follow-up instead of overlapping requests for the same item', async () => {
    const { coalescer, refreshItem } = setup();
    let finish!: () => void;
    refreshItem.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    coalescer.push(row());
    await vi.advanceTimersByTimeAsync(300);
    for (let i = 0; i < 20; i++) coalescer.push(row());
    await vi.advanceTimersByTimeAsync(600);
    expect(refreshItem).toHaveBeenCalledTimes(1);
    finish();
    await vi.advanceTimersByTimeAsync(300);
    expect(refreshItem).toHaveBeenCalledTimes(2);
  });
});
