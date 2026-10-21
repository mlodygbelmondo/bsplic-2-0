import { beforeEach, describe, expect, it, vi } from 'vitest';

const callRpcMock = vi.fn();

vi.mock('@/lib/rpc', () => ({
  callRpc: (...args: unknown[]) => callRpcMock(...args),
}));

const { searchMentionUsers } = await import('./api');

describe('searchMentionUsers', () => {
  beforeEach(() => {
    callRpcMock.mockReset();
  });

  it('does not call the RPC for a blank query', async () => {
    await expect(searchMentionUsers('   ', 'me')).resolves.toEqual([]);
    expect(callRpcMock).not.toHaveBeenCalled();
  });

  it('sends the trimmed query, the viewer and a limit of 6', async () => {
    callRpcMock.mockResolvedValue([{ id: 'u1', username: 'marek' }]);

    await expect(searchMentionUsers(' ma ', 'viewer-1')).resolves.toEqual([{ id: 'u1', username: 'marek' }]);
    expect(callRpcMock).toHaveBeenCalledWith('search_mention_users', {
      p_query: 'ma',
      p_current_user_id: 'viewer-1',
      p_limit: 6,
    });
  });

  it('sends a null viewer when signed out and maps a null result to an empty list', async () => {
    callRpcMock.mockResolvedValue(null);

    await expect(searchMentionUsers('ma')).resolves.toEqual([]);
    expect(callRpcMock).toHaveBeenCalledWith('search_mention_users', {
      p_query: 'ma',
      p_current_user_id: null,
      p_limit: 6,
    });
  });
});
