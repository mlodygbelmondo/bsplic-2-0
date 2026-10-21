import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createBetProposal } from './bet-proposals';

const mocks = vi.hoisted(() => ({
  fromMock: vi.fn(),
  insertMock: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mocks.fromMock,
  },
}));


describe('createBetProposal', () => {
  beforeEach(() => {
    mocks.fromMock.mockReset();
    mocks.insertMock.mockReset();

    mocks.fromMock.mockReturnValue({
      insert: mocks.insertMock,
    });
    mocks.insertMock.mockResolvedValue({ error: null });
  });

  it('inserts only user-controlled proposal fields', async () => {
    await createBetProposal({
      userId: 'user-1',
      title: 'Test proposal',
      categoryId: null,
      betType: 'single',
      options: [{ name: 'Yes', odds: 1.7 }],
      endsAt: '2026-07-04T12:00:00.000Z',
    });

    expect(mocks.fromMock).toHaveBeenCalledWith('bet_proposals');
    expect(mocks.insertMock).toHaveBeenCalledWith({
      user_id: 'user-1',
      title: 'Test proposal',
      category_id: null,
      bet_type: 'single',
      options: [{ name: 'Yes', odds: 1.7 }],
      ends_at: '2026-07-04T12:00:00.000Z',
    });

    const payload = mocks.insertMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('status');
    expect(payload).not.toHaveProperty('proposal_source');
    expect(payload).not.toHaveProperty('agent_metadata');
    expect(payload).not.toHaveProperty('agent_duplicate_key');
    expect(payload).not.toHaveProperty('created_at');
  });

  it('rethrows the database error message', async () => {
    mocks.insertMock.mockResolvedValue({ error: { message: 'permission denied' } });

    await expect(
      createBetProposal({
        userId: 'user-1',
        title: 'Test proposal',
        categoryId: null,
        betType: '12',
        options: [
          { name: '1', odds: 2 },
          { name: '2', odds: 2 },
        ],
        endsAt: '2026-07-04T12:00:00.000Z',
      }),
    ).rejects.toThrow('permission denied');
  });
});
