import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { parseSocialContent } from '@/features/social/content';
import { getSocialImageUrl } from '@/features/social/images';

interface SocialContentBlockProps {
  content: string | null;
  imageAlt: string;
}

interface SocialEmbed {
  provider: 'youtube' | 'spotify';
  src: string;
  title: string;
  compact?: boolean;
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

function getEmbedForUrl(rawUrl: string): SocialEmbed | null {
  try {
    const url = new URL(rawUrl);
    return getYouTubeEmbed(url) ?? getSpotifyEmbed(url);
  } catch {
    return null;
  }
}

export function SocialContentBlock({ content, imageAlt }: SocialContentBlockProps) {
  const parsed = parseSocialContent(content ?? '');

  const tokenRegex = /(https?:\/\/[^\s]+)|@([A-Za-z0-9_.-]{2,32})/g;
  const textParts: Array<string | { type: 'mention' | 'link'; value: string; href?: string }> = [];

  if (parsed.text) {
    let cursor = 0;
    for (const match of parsed.text.matchAll(tokenRegex)) {
      if (typeof match.index !== 'number') continue;

      const fullToken = match[0] ?? '';
      const urlToken = match[1] ?? '';
      const username = match[2] ?? '';
      if (!fullToken) continue;

      if (match.index > cursor) {
        textParts.push(parsed.text.slice(cursor, match.index));
      }

      if (urlToken) {
        textParts.push({ type: 'link', value: urlToken, href: urlToken });
      } else if (username) {
        textParts.push({ type: 'mention', value: `@${username}` });
      }

      cursor = match.index + fullToken.length;
    }

    if (cursor < parsed.text.length) {
      textParts.push(parsed.text.slice(cursor));
    }

    if (textParts.length === 0) {
      textParts.push(parsed.text);
    }
  }

  const embeds: SocialEmbed[] = [];
  const seenEmbedSrc = new Set<string>();

  for (const part of textParts) {
    if (typeof part === 'string' || part.type !== 'link' || !part.href) continue;
    const embed = getEmbedForUrl(part.href);
    if (!embed || seenEmbedSrc.has(embed.src)) continue;
    seenEmbedSrc.add(embed.src);
    embeds.push(embed);
  }

  return (
    <div className="space-y-2">
      {parsed.text ? (
        <p className="text-sm whitespace-pre-wrap break-words">
          {textParts.map((part, index) => {
            if (typeof part === 'string') {
              return <Fragment key={`text-${index}`}>{part}</Fragment>;
            }

            if (part.type === 'link') {
              return (
                <a
                  key={`link-${index}-${part.value}`}
                  href={part.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-semibold text-primary hover:underline"
                >
                  {part.value}
                </a>
              );
            }

            const username = part.value.slice(1);
            return (
              <Link
                key={`mention-${index}-${username}`}
                to={`/profile/${encodeURIComponent(username)}`}
                className="font-semibold text-primary hover:underline"
              >
                {part.value}
              </Link>
            );
          })}
        </p>
      ) : null}
      {parsed.imagePath ? (
        <img
          src={getSocialImageUrl(parsed.imagePath)}
          alt={imageAlt}
          className="rounded-lg border border-border max-h-80 object-cover"
          loading="lazy"
        />
      ) : null}
      {embeds.length > 0 ? (
        <div className="space-y-2">
          {embeds.map((embed) => (
            <iframe
              key={embed.src}
              src={embed.src}
              title={embed.title}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              className={
                embed.provider === 'spotify'
                  ? `w-full rounded-lg border border-border ${embed.compact ? 'h-[152px]' : 'h-[352px]'}`
                  : 'w-full aspect-video rounded-lg border border-border'
              }
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
