import { describe, expect, it } from 'vitest';

import { parseSocialContent } from '../lib/content';
import { formatCommentTime, withCommentImage } from './commentTime';

const NOW = Date.parse('2030-05-10T12:00:00.000Z');
const minutesAgo = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

describe('formatCommentTime', () => {
  it('uses the short comment labels, not the feed "temu" labels', () => {
    expect(formatCommentTime(minutesAgo(0.2), NOW)).toBe('teraz');
    expect(formatCommentTime(minutesAgo(5), NOW)).toBe('5 min');
    expect(formatCommentTime(minutesAgo(23 * 60 + 59), NOW)).toBe('23 godz.');
    expect(formatCommentTime(minutesAgo(6 * 24 * 60), NOW)).toBe('6 dn.');
  });

  it('switches to the Polish date after a week', () => {
    expect(formatCommentTime('2030-05-01T09:00:00.000Z', NOW)).toBe('1.05.2030');
  });
});

describe('withCommentImage', () => {
  it('restores the image marker so the content block shows the photo', () => {
    expect(parseSocialContent(withCommentImage('Patrz', 'u1/1-abc.jpg'))).toEqual({
      text: 'Patrz',
      imagePath: 'u1/1-abc.jpg',
    });
  });

  it('keeps text-only comments unchanged', () => {
    expect(withCommentImage('Sam tekst', null)).toBe('Sam tekst');
  });
});
