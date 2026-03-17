import { describe, expect, it, vi } from 'vitest';
import { getSocialImageUrl, SOCIAL_IMAGES_BUCKET } from '@/features/social/images';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: {
      from: () => ({
        getPublicUrl: (path: string) => ({
          data: {
            publicUrl: `https://example.com/storage/v1/object/public/${SOCIAL_IMAGES_BUCKET}/${path}`,
          },
        }),
      }),
    },
  },
}));

describe('social images helpers', () => {
  it('uses social images bucket in public URL', () => {
    const url = getSocialImageUrl('user-1/example.jpg');
    expect(url).toContain(SOCIAL_IMAGES_BUCKET);
    expect(url).toContain('user-1/example.jpg');
  });
});
