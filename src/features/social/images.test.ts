import { describe, expect, it, vi } from 'vitest';
import { getSocialImageUrl } from '@/features/social/images';

const fromMock = vi.hoisted(() => vi.fn());
const getPublicUrlMock = vi.hoisted(() => vi.fn());

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: {
      from: fromMock,
    },
  },
}));

describe('social images helpers', () => {
  it('requests the social images bucket and returns its public URL', () => {
    fromMock.mockReturnValue({ getPublicUrl: getPublicUrlMock });
    getPublicUrlMock.mockReturnValue({
      data: { publicUrl: 'https://example.com/social-image.jpg' },
    });

    const url = getSocialImageUrl('user-1/example.jpg');

    expect(fromMock).toHaveBeenCalledWith('social-images');
    expect(getPublicUrlMock).toHaveBeenCalledWith('user-1/example.jpg');
    expect(url).toBe('https://example.com/social-image.jpg');
  });
});
