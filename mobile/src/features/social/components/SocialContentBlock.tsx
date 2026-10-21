import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useWindowDimensions, View } from 'react-native';

import { createStyles } from '@/theme';
import { Text } from '@/ui';
import { getSocialImageUrl } from '../images';
import { parseSocialContent } from '../lib/content';
import { collectEmbeds, tokenizeSocialText } from '../lib/contentTokens';
import { SocialEmbed } from './SocialEmbed';
import { SocialImage } from './SocialImage';
import { social } from './socialColors';

/** Card body padding on phones (`px-3` on both sides). */
const CARD_CONTENT_INSET = 24;

interface SocialContentBlockProps {
  content: string | null | undefined;
  imageAlt: string;
  /** Key of the feed card, for the embed visibility gate and image recycling. */
  itemKey: string;
  /** Content width; defaults to the window width minus the card padding. */
  width?: number;
}

function openLink(href: string) {
  void WebBrowser.openBrowserAsync(href).catch(() => undefined);
}

/**
 * Web `SocialContentBlock`: text with links and `@mentions`, the attached
 * image and YouTube/Spotify players (deduplicated by `src`).
 */
export function SocialContentBlock({ content, imageAlt, itemKey, width }: SocialContentBlockProps) {
  const styles = useStyles();
  const windowWidth = useWindowDimensions().width;
  const contentWidth = width ?? windowWidth - CARD_CONTENT_INSET;
  const parsed = parseSocialContent(content);
  const parts = tokenizeSocialText(parsed.text);
  const embeds = collectEmbeds(parts);

  return (
    <View style={styles.root}>
      {parsed.text ? (
        <Text style={styles.text}>
          {parts.map((part, index) => {
            if (part.type === 'text') return part.value;
            if (part.type === 'link') {
              return (
                <Text
                  key={`link-${index}-${part.value}`}
                  accessibilityRole="link"
                  suppressHighlighting={false}
                  onPress={() => openLink(part.href)}
                  style={styles.link}
                >
                  {part.value}
                </Text>
              );
            }
            return (
              <Text
                key={`mention-${index}-${part.username}`}
                accessibilityRole="link"
                onPress={() => router.push({ pathname: '/profile/[userId]', params: { userId: part.username } })}
                style={styles.link}
              >
                {part.value}
              </Text>
            );
          })}
        </Text>
      ) : null}
      {parsed.imagePath ? (
        <SocialImage
          key={parsed.imagePath}
          uri={getSocialImageUrl(parsed.imagePath)}
          alt={imageAlt}
          maxWidth={contentWidth}
          recyclingKey={`${itemKey}-image`}
        />
      ) : null}
      {embeds.length > 0 ? (
        <View style={styles.embeds}>
          {embeds.map((embed) => (
            <SocialEmbed key={embed.src} embed={embed} width={contentWidth} itemKey={itemKey} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = createStyles(() => ({
  // `space-y-2`.
  root: { gap: 8 },
  // `text-sm whitespace-pre-wrap break-words`.
  text: { fontSize: 14, lineHeight: 20, color: social.foreground },
  // `font-semibold text-primary`.
  link: { fontWeight: '600', color: social.primary },
  embeds: { gap: 8 },
}));
