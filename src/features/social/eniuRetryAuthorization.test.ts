import { describe, expect, it, vi } from 'vitest';

import { resolveReplyActorId } from '../../../supabase/functions/_shared/eniuRetryAuthorization';

describe('Eniu reply actor authorization', () => {
  it('uses the signed-in user for a new reply without loading another author', async () => {
    const assertAdmin = vi.fn();
    const loadSourceUserId = vi.fn();

    await expect(resolveReplyActorId({
      retry: false,
      authenticatedUserId: 'signed-in-user',
      assertAdmin,
      loadSourceUserId,
    })).resolves.toEqual({ status: 'ok', userId: 'signed-in-user' });
    expect(assertAdmin).not.toHaveBeenCalled();
    expect(loadSourceUserId).not.toHaveBeenCalled();
  });

  it('rejects a retry before looking up the source when admin access fails', async () => {
    const loadSourceUserId = vi.fn();

    await expect(resolveReplyActorId({
      retry: true,
      authenticatedUserId: 'signed-in-user',
      assertAdmin: vi.fn().mockRejectedValue(new Error('Forbidden')),
      loadSourceUserId,
    })).resolves.toEqual({ status: 'forbidden' });
    expect(loadSourceUserId).not.toHaveBeenCalled();
  });

  it('attributes an authorized retry to the original source author', async () => {
    const assertAdmin = vi.fn().mockResolvedValue(undefined);
    const loadSourceUserId = vi.fn().mockResolvedValue('source-author');

    await expect(resolveReplyActorId({
      retry: true,
      authenticatedUserId: 'admin-user',
      assertAdmin,
      loadSourceUserId,
    })).resolves.toEqual({ status: 'ok', userId: 'source-author' });
    expect(assertAdmin).toHaveBeenCalledOnce();
    expect(loadSourceUserId).toHaveBeenCalledOnce();
  });

  it('fails when the source for an authorized retry has disappeared', async () => {
    await expect(resolveReplyActorId({
      retry: true,
      authenticatedUserId: 'admin-user',
      assertAdmin: vi.fn().mockResolvedValue(undefined),
      loadSourceUserId: vi.fn().mockResolvedValue(null),
    })).rejects.toThrow('Social bot source not found');
  });
});
