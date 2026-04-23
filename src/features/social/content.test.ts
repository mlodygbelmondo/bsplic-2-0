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
      const expected = `[[img:${path}]]`.length;
      expect(getImageMarkerLength(path)).toBe(expected);
    });

    it('returns correct length for an empty path', () => {
      const path = '';
      const expected = `[[img:${path}]]`.length;
      expect(getImageMarkerLength(path)).toBe(expected);
    });

    it('returns correct length for a path with special characters', () => {
      const path = 'user/abc-123_456.png?v=1';
      const expected = `[[img:${path}]]`.length;
      expect(getImageMarkerLength(path)).toBe(expected);
    });
  });
});
