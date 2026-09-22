import { describe, expect, it } from 'vitest';
import { buildSocialContent, parseSocialContent, getImageMarkerLength } from '@/features/social/content';

describe('social content parser', () => {
  it('returns plain text when marker is missing', () => {
    expect(parseSocialContent('Hello world')).toEqual({
      text: 'Hello world',
      imagePath: null,
    });
  });

  it('extracts image marker from content', () => {
    expect(parseSocialContent('Hello\n[[img:user/123.jpg]]')).toEqual({
      text: 'Hello',
      imagePath: 'user/123.jpg',
    });
  });

  it('builds payload with marker', () => {
    expect(buildSocialContent('Czesc', 'u1/abc.jpg')).toBe('Czesc\n[[img:u1/abc.jpg]]');
  });

  describe('getImageMarkerLength', () => {
    it('returns correct length for a standard path', () => {
      const path = 'user/123.jpg';
      expect(getImageMarkerLength(path)).toBe(20);
    });

    it('returns correct length for an empty path', () => {
      const path = '';
      expect(getImageMarkerLength(path)).toBe(8);
    });
  });
});
