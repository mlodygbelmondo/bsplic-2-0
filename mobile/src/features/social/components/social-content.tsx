import { useState } from 'react';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { ExternalLink } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/hooks/use-app-theme';

import { extractSocialEmbeds, parseSocialContent, type SocialEmbed } from '../content';
import { getSocialImageUrl } from '../images';

export function SocialContent({ content, imageLabel = 'Zdjęcie w publikacji' }: { content: string | null; imageLabel?: string }) {
  const { tokens } = useAppTheme();
  const parsed = parseSocialContent(content);
  const embeds = extractSocialEmbeds(parsed.text);
  return (
    <View style={styles.content}>
      {parsed.text ? <AppText selectable>{parsed.text}</AppText> : null}
      {parsed.imagePath ? (
        <Image
          source={{ uri: getSocialImageUrl(parsed.imagePath) }}
          accessibilityLabel={imageLabel}
          contentFit="cover"
          transition={150}
          style={[styles.image, { backgroundColor: tokens.colors.muted }]}
        />
      ) : null}
      {embeds.map((embed) => <SafeEmbed key={`${embed.kind}-${embed.id}`} embed={embed} />)}
    </View>
  );
}

function SafeEmbed({ embed }: { embed: SocialEmbed }) {
  const { tokens } = useAppTheme();
  const [failed, setFailed] = useState(false);
  const allowedHosts = embed.kind === 'youtube'
    ? ['youtube-nocookie.com', 'youtube.com', 'googlevideo.com']
    : ['spotify.com', 'scdn.co'];

  const openExternal = () => { void Linking.openURL(embed.url); };
  return (
    <View style={[styles.embed, { borderColor: tokens.colors.border, backgroundColor: tokens.colors.muted }]}>
      {!failed ? (
        <WebView
          source={{ uri: embed.embedUrl }}
          style={styles.webView}
          javaScriptEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction
          setSupportMultipleWindows={false}
          onError={() => setFailed(true)}
          onHttpError={() => setFailed(true)}
          onShouldStartLoadWithRequest={(request) => {
            if (request.url === 'about:blank') return true;
            try {
              const host = new URL(request.url).hostname.toLowerCase();
              const allowed = allowedHosts.some((candidate) => host === candidate || host.endsWith(`.${candidate}`));
              return allowed;
            } catch {
              return false;
            }
          }}
        />
      ) : (
        <View style={styles.embedFallback}>
          <AppText variant="label">Nie udało się wczytać {embed.kind === 'youtube' ? 'YouTube' : 'Spotify'}.</AppText>
        </View>
      )}
      <Pressable accessibilityRole="link" accessibilityLabel="Otwórz materiał w zewnętrznej aplikacji" onPress={openExternal} style={styles.externalButton}>
        <ExternalLink size={15} color={tokens.colors.primary} />
        <AppText variant="caption" tone="primary">Otwórz zewnętrznie</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 10 },
  image: { width: '100%', aspectRatio: 4 / 3, borderRadius: 14 },
  embed: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, overflow: 'hidden' },
  webView: { height: 220, backgroundColor: 'transparent' },
  embedFallback: { height: 140, alignItems: 'center', justifyContent: 'center', padding: 16 },
  externalButton: { minHeight: 44, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
});
