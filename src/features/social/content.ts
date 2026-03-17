const IMAGE_MARKER_REGEX = /(?:\n)?\[\[img:([^\]\n]+)\]\]\s*$/;

export interface ParsedSocialContent {
  text: string;
  imagePath: string | null;
}

export function parseSocialContent(content: string | null | undefined): ParsedSocialContent {
  const raw = content ?? '';
  const match = raw.match(IMAGE_MARKER_REGEX);

  if (!match || typeof match.index !== 'number') {
    return {
      text: raw,
      imagePath: null,
    };
  }

  return {
    text: raw.slice(0, match.index).trimEnd(),
    imagePath: match[1] ?? null,
  };
}

export function buildSocialContent(text: string, imagePath?: string | null): string {
  const normalizedText = text.trim();
  if (!imagePath) return normalizedText;

  if (!normalizedText) {
    return `[[img:${imagePath}]]`;
  }

  return `${normalizedText}\n[[img:${imagePath}]]`;
}

export function getImageMarkerLength(imagePath: string): number {
  return `[[img:${imagePath}]]`.length;
}
