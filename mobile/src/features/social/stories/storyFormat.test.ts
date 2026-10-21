import { describe, expect, it } from 'vitest';

import { formatStoryAge, formatStoryTimeLeft, getActiveStories, resolveStoryIndex } from './storyFormat';

const NOW = Date.parse('2030-05-10T12:00:00.000Z');
const minutesFromNow = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString();

describe('formatStoryAge', () => {
  it('says "teraz" under a minute', () => {
    expect(formatStoryAge(minutesFromNow(-0.5), NOW)).toBe('teraz');
  });

  it('counts whole minutes under an hour', () => {
    expect(formatStoryAge(minutesFromNow(-59.9), NOW)).toBe('59 min');
  });

  it('counts whole hours from an hour on', () => {
    expect(formatStoryAge(minutesFromNow(-150), NOW)).toBe('2 godz.');
  });
});

describe('formatStoryTimeLeft', () => {
  it('says "znika za chwilę" with a minute or less left', () => {
    expect(formatStoryTimeLeft(minutesFromNow(1), NOW)).toBe('znika za chwilę');
    expect(formatStoryTimeLeft(minutesFromNow(-5), NOW)).toBe('znika za chwilę');
  });

  it('rounds minutes up under an hour', () => {
    expect(formatStoryTimeLeft(minutesFromNow(12.2), NOW)).toBe('znika za 13 min');
  });

  it('rounds hours up', () => {
    expect(formatStoryTimeLeft(minutesFromNow(61), NOW)).toBe('znika za 2 godz.');
    expect(formatStoryTimeLeft(minutesFromNow(24 * 60), NOW)).toBe('znika za 24 godz.');
  });
});

describe('getActiveStories', () => {
  it('drops expired stories and keeps the server order', () => {
    const stories = [
      { id: 'b', user_id: 'u', username: 'b', content: null, created_at: minutesFromNow(-10), expires_at: minutesFromNow(5) },
      { id: 'old', user_id: 'u', username: 'o', content: null, created_at: minutesFromNow(-1500), expires_at: minutesFromNow(0) },
      { id: 'a', user_id: 'u', username: 'a', content: null, created_at: minutesFromNow(-20), expires_at: minutesFromNow(60) },
    ];
    expect(getActiveStories(stories, NOW).map((story) => story.id)).toEqual(['b', 'a']);
  });
});

describe('resolveStoryIndex', () => {
  const stories = [{ id: 's1' }, { id: 's2' }, { id: 's3' }];

  it('prefers the tapped story id over the position', () => {
    expect(resolveStoryIndex(stories, 's3', 0)).toBe(2);
  });

  it('falls back to the position, clamped to the list', () => {
    expect(resolveStoryIndex(stories, 'gone', 1)).toBe(1);
    expect(resolveStoryIndex(stories, undefined, 9)).toBe(2);
    expect(resolveStoryIndex(stories, undefined, Number.NaN)).toBe(0);
  });
});
