const IMAGE_MARKER = /(?:\n)?\[\[img:([^\]\n]+)\]\]\s*$/;
const ENIU_MENTION = /(^|\s)@eniu(?=$|[\s.,!?;:])/i;

export interface ParsedSocialContent {
  text: string;
  imagePath: string | null;
}

export type SocialEmbed =
  | { kind: 'youtube'; id: string; url: string; embedUrl: string }
  | { kind: 'spotify'; id: string; url: string; embedUrl: string };

export function parseSocialContent(content: string | null | undefined): ParsedSocialContent {
  const raw = content ?? '';
  const match = raw.match(IMAGE_MARKER);
  if (!match || typeof match.index !== 'number') return { text: raw, imagePath: null };
  return { text: raw.slice(0, match.index).trimEnd(), imagePath: match[1] ?? null };
}

export function buildSocialContent(text: string, imagePath?: string | null): string {
  const normalized = text.trim();
  if (!imagePath) return normalized;
  return normalized ? `${normalized}\n[[img:${imagePath}]]` : `[[img:${imagePath}]]`;
}

export function mentionsEniu(text: string): boolean {
  return ENIU_MENTION.test(text);
}

export function extractSocialEmbeds(text: string): SocialEmbed[] {
  const urls = text.match(/https?:\/\/[^\s<>()]+/gi) ?? [];
  const embeds: SocialEmbed[] = [];
  const seen = new Set<string>();

  for (const rawUrl of urls) {
    const url = rawUrl.replace(/[.,!?;:)]+$/, '');
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
      let embed: SocialEmbed | null = null;

      if (host === 'youtu.be') {
        const id = parsed.pathname.split('/').filter(Boolean)[0];
        if (id) embed = { kind: 'youtube', id, url, embedUrl: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` };
      } else if (host === 'youtube.com' || host === 'm.youtube.com') {
        const parts = parsed.pathname.split('/').filter(Boolean);
        const id = parsed.pathname === '/watch' ? parsed.searchParams.get('v') : parts[0] === 'shorts' || parts[0] === 'embed' ? parts[1] : null;
        if (id) embed = { kind: 'youtube', id, url, embedUrl: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` };
      } else if (host === 'open.spotify.com') {
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (parts.length >= 2 && ['track', 'album', 'playlist', 'episode', 'show'].includes(parts[0])) {
          const id = `${parts[0]}/${parts[1]}`;
          embed = { kind: 'spotify', id, url, embedUrl: `https://open.spotify.com/embed/${id}` };
        }
      }

      if (embed && !seen.has(`${embed.kind}:${embed.id}`)) {
        seen.add(`${embed.kind}:${embed.id}`);
        embeds.push(embed);
      }
    } catch {
      // Ignore malformed URLs while keeping the surrounding post readable.
    }
  }

  return embeds.slice(0, 2);
}
