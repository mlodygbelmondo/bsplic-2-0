import { describe, expect, it } from 'vitest';

import { collectEmbeds, tokenizeSocialText } from './contentTokens';

describe('tokenizeSocialText', () => {
  it('turns a mention into a profile link token', () => {
    const parts = tokenizeSocialText('Hej @tester, co tam?');
    expect(parts).toEqual([
      { type: 'text', value: 'Hej ' },
      { type: 'mention', value: '@tester', username: 'tester' },
      { type: 'text', value: ', co tam?' },
    ]);
  });

  it('turns a plain URL into an external link token', () => {
    expect(tokenizeSocialText('Sprawdź https://example.com/test')).toEqual([
      { type: 'text', value: 'Sprawdź ' },
      { type: 'link', value: 'https://example.com/test', href: 'https://example.com/test' },
    ]);
  });

  it('keeps trailing punctuation inside the URL like the web regex', () => {
    expect(tokenizeSocialText('patrz https://a.pl/x!')[1]).toEqual({
      type: 'link',
      value: 'https://a.pl/x!',
      href: 'https://a.pl/x!',
    });
  });

  it('does not link one-letter or Polish-letter mentions', () => {
    expect(tokenizeSocialText('@a i @łukasz')).toEqual([{ type: 'text', value: '@a i @łukasz' }]);
  });
});

describe('collectEmbeds', () => {
  it('embeds supported YouTube links through youtube-nocookie', () => {
    const embeds = collectEmbeds(tokenizeSocialText('https://www.youtube.com/watch?v=dQw4w9WgXcQ'));
    expect(embeds).toEqual([
      {
        provider: 'youtube',
        src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        title: 'Osadzony film YouTube',
        videoId: 'dQw4w9WgXcQ',
      },
    ]);
  });

  it('reads short, shorts and live YouTube URLs', () => {
    const embeds = collectEmbeds(
      tokenizeSocialText('https://youtu.be/abc123 https://m.youtube.com/shorts/def456 https://youtube.com/live/ghi789'),
    );
    expect(embeds.map((embed) => embed.videoId)).toEqual(['abc123', 'def456', 'ghi789']);
  });

  it('embeds Spotify tracks compactly and strips the intl segment', () => {
    const [track, playlist] = collectEmbeds(
      tokenizeSocialText(
        'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC https://open.spotify.com/intl-pl/playlist/37i9dQZF1DXcBWIGoYBM5M',
      ),
    );
    expect(track).toMatchObject({
      provider: 'spotify',
      src: 'https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC',
      title: 'Osadzony odtwarzacz Spotify',
      compact: true,
    });
    expect(playlist).toMatchObject({ src: 'https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M', compact: false });
  });

  it('deduplicates embeds and ignores unsupported hosts and types', () => {
    const embeds = collectEmbeds(
      tokenizeSocialText(
        'https://youtu.be/abc https://www.youtube.com/watch?v=abc https://open.spotify.com/artist/xyz https://vimeo.com/1',
      ),
    );
    expect(embeds).toHaveLength(1);
  });
});
