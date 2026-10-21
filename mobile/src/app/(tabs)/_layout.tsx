import { usePathname } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';

import { useScheme } from '@/theme';

/**
 * Primary navigation (web bottom nav): Zakłady, Social, Gry, Rankingi, Profil.
 * Colors follow the web liquid-glass nav: gold on dark and casino screens,
 * brand red otherwise. Native glass takes on the content behind it, so the
 * always-white phone Social feed gets the light colors.
 */
export default function TabsLayout() {
  const scheme = useScheme();
  const pathname = usePathname();
  const onDark = !pathname.startsWith('/social') && (scheme === 'dark' || pathname.startsWith('/casino'));
  const selected = onDark ? '#ffe14a' : '#c90018';
  const idle = onDark ? 'rgba(255, 255, 255, 0.68)' : 'rgba(2, 6, 23, 0.82)';
  // The web hides its bottom nav on scroll only on home, Social and rankings.
  const hidesOnScroll = pathname === '/' || pathname.startsWith('/social') || pathname.startsWith('/rankings');
  return (
    <NativeTabs
      minimizeBehavior={hidesOnScroll ? 'onScrollDown' : 'never'}
      tintColor={selected}
      iconColor={{ default: idle, selected }}
      labelStyle={{ default: { color: idle }, selected: { color: selected } }}
    >
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
        <NativeTabs.Trigger.Label>Zakłady</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="social">
        <NativeTabs.Trigger.Icon sf={{ default: 'message', selected: 'message.fill' }} md="chat_bubble" />
        <NativeTabs.Trigger.Label>Social</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="casino">
        <NativeTabs.Trigger.Icon sf={{ default: 'gamecontroller', selected: 'gamecontroller.fill' }} md="sports_esports" />
        <NativeTabs.Trigger.Label>Gry</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="rankings">
        <NativeTabs.Trigger.Icon sf={{ default: 'trophy', selected: 'trophy.fill' }} md="emoji_events" />
        <NativeTabs.Trigger.Label>Rankingi</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon sf={{ default: 'person', selected: 'person.fill' }} md="person" />
        <NativeTabs.Trigger.Label>Profil</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
