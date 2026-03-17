import { parseSocialContent } from '@/features/social/content';
import { getSocialImageUrl } from '@/features/social/images';

interface SocialContentBlockProps {
  content: string | null;
  imageAlt: string;
}

export function SocialContentBlock({ content, imageAlt }: SocialContentBlockProps) {
  const parsed = parseSocialContent(content ?? '');

  return (
    <div className="space-y-2">
      {parsed.text ? <p className="text-sm whitespace-pre-wrap">{parsed.text}</p> : null}
      {parsed.imagePath ? (
        <img
          src={getSocialImageUrl(parsed.imagePath)}
          alt={imageAlt}
          className="rounded-lg border border-border max-h-80 object-cover"
          loading="lazy"
        />
      ) : null}
    </div>
  );
}
