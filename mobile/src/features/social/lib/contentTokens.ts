/**
 * Text tokenizer and embed detection behind the web `SocialContentBlock`:
 * URLs become links, `@username` becomes a profile link, and YouTube/Spotify
 * URLs also produce embeds (deduplicated by `src`).
 */

export type SocialTextPart =
  | { type: 'text'; value: string }
  | { type: 'link'; value: string; href: string }
  | { type: 'mention'; value: string; username: string };

export interface SocialEmbed {
  provider: 'youtube' | 'spotify';
  src: string;
  title: string;
  /** Spotify track/episode players are 152 px tall, others 352 px. */
  compact?: boolean;
  /** YouTube video id (poster thumbnail before the player mounts). */
  videoId?: string;
}

const TOKEN_REGEX = /(https?:\/\/[^\s]+)|@([A-Za-z0-9_.-]{2,32})/g;

export function tokenizeSocialText(text: string): SocialTextPart[] {
  if (!text) return [];
  const parts: SocialTextPart[] = [];
  let cursor = 0;

  for (const match of text.matchAll(TOKEN_REGEX)) {
    if (typeof match.index !== 'number') continue;
    const fullToken = match[0] ?? '';
    const urlToken = match[1] ?? '';
    const username = match[2] ?? '';
    if (!fullToken) continue;

    if (match.index > cursor) {
      parts.push({ type: 'text', value: text.slice(cursor, match.index) });
    }

    if (urlToken) {
      parts.push({ type: 'link', value: urlToken, href: urlToken });
    } else if (username) {
      parts.push({ type: 'mention', value: `@${username}`, username });
    }

    cursor = match.index + fullToken.length;
  }

  if (cursor < text.length) {
    parts.push({ type: 'text', value: text.slice(cursor) });
  }

  return parts.length > 0 ? parts : [{ type: 'text', value: text }];
}

function getYouTubeEmbed(url: URL): SocialEmbed | null {
  const host = url.hostname.toLowerCase();
  let videoId = '';

  if (host === 'youtu.be') {
    videoId = url.pathname.split('/').filter(Boolean)[0] ?? '';
  } else if (host.endsWith('youtube.com')) {
    if (url.pathname === '/watch') {
      videoId = url.searchParams.get('v') ?? '';
    } else {
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0] === 'shorts' || parts[0] === 'live' || parts[0] === 'embed') {
        videoId = parts[1] ?? '';
      }
    }
  }

  if (!videoId) return null;

  return {
    provider: 'youtube',
    src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`,
    title: 'Osadzony film YouTube',
    videoId,
  };
}

function getSpotifyEmbed(url: URL): SocialEmbed | null {
  const host = url.hostname.toLowerCase();
  if (host !== 'open.spotify.com') return null;

  const parts = url.pathname.split('/').filter(Boolean);
  const cleanedParts = parts[0]?.startsWith('intl-') ? parts.slice(1) : parts;
  const type = cleanedParts[0];
  const id = cleanedParts[1];
  if (!type || !id) return null;

  const allowedTypes = new Set(['track', 'album', 'playlist', 'episode', 'show']);
  if (!allowedTypes.has(type)) return null;

  return {
    provider: 'spotify',
    src: `https://open.spotify.com/embed/${type}/${encodeURIComponent(id)}`,
    title: 'Osadzony odtwarzacz Spotify',
    compact: type === 'track' || type === 'episode',
  };
}

export function getEmbedForUrl(rawUrl: string): SocialEmbed | null {
  try {
    const url = new URL(rawUrl);
    return getYouTubeEmbed(url) ?? getSpotifyEmbed(url);
  } catch {
    return null;
  }
}

export function collectEmbeds(parts: SocialTextPart[]): SocialEmbed[] {
  const embeds: SocialEmbed[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    if (part.type !== 'link') continue;
    const embed = getEmbedForUrl(part.href);
    if (!embed || seen.has(embed.src)) continue;
    seen.add(embed.src);
    embeds.push(embed);
  }
  return embeds;
}

