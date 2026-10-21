import { describe, expect, it, vi } from 'vitest';

import { getScaledDimensions, getSocialImageUrl } from './images';

const fromMock = vi.hoisted(() => vi.fn());
const getPublicUrlMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase', () => ({ supabase: { storage: { from: fromMock } } }));
vi.mock('expo-file-system', () => ({ File: class {} }));
vi.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: { JPEG: 'jpeg' } }));

describe('social images helpers', () => {
  it('requests the social images bucket and returns its public URL', () => {
    fromMock.mockReturnValue({ getPublicUrl: getPublicUrlMock });
    getPublicUrlMock.mockReturnValue({ data: { publicUrl: 'https://example.com/social-image.jpg' } });

    const url = getSocialImageUrl('user-1/example.jpg');

    expect(fromMock).toHaveBeenCalledWith('social-images');
    expect(getPublicUrlMock).toHaveBeenCalledWith('user-1/example.jpg');
    expect(url).toBe('https://example.com/social-image.jpg');
  });

  it('fits the longer side into the maximum dimension and keeps small images', () => {
    expect(getScaledDimensions(4032, 3024, 1280)).toEqual({ width: 1280, height: 960 });
    expect(getScaledDimensions(1080, 1920, 1280)).toEqual({ width: 720, height: 1280 });
    expect(getScaledDimensions(800, 600, 1280)).toEqual({ width: 800, height: 600 });
  });
});
