import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createSocialStory,
  fetchActiveSocialStories,
} from '@/features/social/api/social';

const rpcMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

describe('social stories API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads active stories through the active-story RPC', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          id: 'story-1',
          user_id: 'user-1',
          username: 'Tester',
          avatar_url: null,
          content: 'Dzień dobry',
          created_at: '2026-06-23T10:00:00.000Z',
          expires_at: '2026-06-24T10:00:00.000Z',
        },
      ],
      error: null,
    });

    await expect(fetchActiveSocialStories()).resolves.toEqual([
      expect.objectContaining({
        id: 'story-1',
        username: 'Tester',
        expires_at: '2026-06-24T10:00:00.000Z',
      }),
    ]);
    expect(rpcMock).toHaveBeenCalledWith('get_active_social_stories');
  });

  it('creates a story through the ownership-checked story RPC', async () => {
    rpcMock.mockResolvedValue({ data: 'story-new', error: null });

    await expect(
      createSocialStory('user-1', 'Nowa relacja'),
    ).resolves.toBe('story-new');

    expect(rpcMock).toHaveBeenCalledWith('create_social_story', {
      p_user_id: 'user-1',
      p_content: 'Nowa relacja',
    });
  });
});
