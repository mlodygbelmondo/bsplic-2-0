import { describe, expect, it } from 'vitest';
import { buildSocialContent, parseSocialContent } from '@/features/social/content';

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
});
