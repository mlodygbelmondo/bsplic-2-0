/* eslint-disable @typescript-eslint/no-require-imports -- Metro resolves bundled image assets through static require calls. */
import { ImageBackground, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';

const games = [
  { title: 'Ruletka', subtitle: 'Klasyczna ruletka z mnożnikami. Obstawiaj kolory, parzyste lub swoje szczęśliwe numery.', href: '/casino/roulette' as const, image: require('../../../../assets/images/casino/roulette-button.webp') },
  { title: 'Blackjack', subtitle: 'Zagraj przeciwko krupierowi. Dobieraj karty i zbliż się do punktu 21.', href: '/casino/blackjack' as const, image: require('../../../../assets/images/casino/blackjack-button.webp') },
];

export function CasinoLobbyScreen() {
  return <ImageBackground source={require('../../../../assets/images/casino/hub-mobile-background.webp')} resizeMode="cover" style={{ flex: 1, backgroundColor: '#09090b' }}><ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 116, gap: 20 }}><View style={{ alignItems: 'center', paddingBottom: 8, gap: 7 }}><Text allowFontScaling={false} style={{ color: '#fff', fontSize: 30, fontWeight: '900' }}>CASINO HUB</Text><Text allowFontScaling={false} style={{ color: '#b7afba', fontSize: 14 }}>Wybierz grę i spróbuj swojego szczęścia</Text></View>{games.map(game => <Pressable key={game.href} onPress={() => router.push(game.href)} style={{ height: 310, overflow: 'hidden', borderRadius: 24, borderWidth: 1, borderColor: '#ffffff28', backgroundColor: '#0b080d' }}><ImageBackground source={game.image} resizeMode="cover" style={{ flex: 1, justifyContent: 'flex-end' }} imageStyle={{ opacity: 0.82 }}><View style={{ padding: 24, paddingTop: 80, backgroundColor: '#00000055', gap: 6 }}><Text allowFontScaling={false} style={{ color: '#fff', fontSize: 27, fontWeight: '900' }}>{game.title}</Text><Text allowFontScaling={false} style={{ color: '#eee', fontSize: 14, lineHeight: 20 }}>{game.subtitle}</Text></View></ImageBackground></Pressable>)}</ScrollView></ImageBackground>;
}
