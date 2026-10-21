import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { View } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';

import { env } from '@/lib/env';
import { createStyles } from '@/theme';
import type { SocialEmbed as SocialEmbedData } from '../lib/contentTokens';
import { useFeedItemVisible } from './feedVisibility';
import { social } from './socialColors';

/** The web iframe attributes (`SocialContentBlock`). */
const IFRAME_ALLOW = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';

/**
 * The player runs in an iframe inside a page served from the web origin, so
 * YouTube and Spotify get the same referrer as on the PWA (YouTube refuses
 * embeds without one).
 */
function buildEmbedHtml(embed: SocialEmbedData): string {
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>html,body{margin:0;padding:0;height:100%;overflow:hidden;background:transparent}iframe{display:block;width:100%;height:100%;border:0}</style></head><body><iframe src="${embed.src}" title="${embed.title}" allow="${IFRAME_ALLOW}" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></body></html>`;
}

function openExternally(url: string) {
  void WebBrowser.openBrowserAsync(url).catch(() => undefined);
}

function handleShouldStartLoad(request: WebViewNavigation & { isTopFrame?: boolean }): boolean {
  // Player frames load freely; links that would replace the page open in the browser.
  if (request.isTopFrame === false) return true;
  if (request.url === 'about:blank' || request.url.startsWith(env.webUrl)) return true;
  openExternally(request.url);
  return false;
}

export function getEmbedHeight(embed: SocialEmbedData, width: number): number {
  if (embed.provider === 'spotify') return embed.compact ? 152 : 352;
  return Math.round((width * 9) / 16);
}

/**
 * YouTube (`aspect-video`) or Spotify (152/352 pt) player. The web view mounts
 * once the card has been on screen; until then a poster keeps the size.
 */
export function SocialEmbed({ embed, width, itemKey }: { embed: SocialEmbedData; width: number; itemKey: string }) {
  const styles = useStyles();
  const visible = useFeedItemVisible(itemKey);
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);

  return (
    <View
      accessibilityLabel={embed.title}
      // Taps inside a player never open the item, like clicks inside a web iframe.
      onStartShouldSetResponder={() => true}
      style={[styles.frame, { width, height: getEmbedHeight(embed, width) }]}
    >
      {mounted ? (
        <WebView
          source={{ html: buildEmbedHtml(embed), baseUrl: env.webUrl }}
          originWhitelist={['*']}
          style={styles.webView}
          scrollEnabled={false}
          bounces={false}
          allowsInlineMediaPlayback
          allowsFullscreenVideo
          setSupportMultipleWindows={false}
          onShouldStartLoadWithRequest={handleShouldStartLoad}
          onOpenWindow={(event) => openExternally(event.nativeEvent.targetUrl)}
        />
      ) : embed.videoId ? (
        <Image
          source={{ uri: `https://i.ytimg.com/vi/${encodeURIComponent(embed.videoId)}/hqdefault.jpg` }}
          style={styles.poster}
          contentFit="cover"
          recyclingKey={embed.src}
        />
      ) : null}
    </View>
  );
}

const useStyles = createStyles(({ radius }) => ({
  frame: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: social.border,
    backgroundColor: social.muted,
  },
  webView: { flex: 1, backgroundColor: 'transparent' },
  poster: { flex: 1 },
}));
