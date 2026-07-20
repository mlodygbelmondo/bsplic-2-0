/* eslint-disable @typescript-eslint/no-require-imports -- Metro resolves bundled image assets through static require calls. */
import { ImageBackground, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';

const games = [
  { title: 'Ruletka', subtitle: 'Wspólny stół na żywo', href: '/casino/roulette' as const, image: require('../../../../assets/images/casino/roulette-button.webp') },
  { title: 'Blackjack', subtitle: 'Prywatny stół, serwerowe rozdanie', href: '/casino/blackjack' as const, image: require('../../../../assets/images/casino/blackjack-button.webp') },
];

export function CasinoLobbyScreen() {
  return <ScrollView style={{ flex: 1, backgroundColor: '#09090b' }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 14, paddingBottom: 116, gap: 14 }}><View style={{ paddingVertical: 12, gap: 4 }}><Text style={{ color: '#ffe14a', fontSize: 11, letterSpacing: 2, fontWeight: '900' }}>BSPLIC CASINO</Text><Text style={{ color: '#fff', fontSize: 30, fontWeight: '900' }}>Wybierz grę</Text><Text style={{ color: '#b7afba' }}>Wyniki i saldo są rozliczane na serwerze.</Text></View>{games.map(game => <Pressable key={game.href} onPress={() => router.push(game.href)} style={({ pressed }) => ({ height: 220, overflow: 'hidden', borderRadius: 22, borderWidth: 1, borderColor: '#ffffff20', opacity: pressed ? 0.82 : 1 })}><ImageBackground source={game.image} style={{ flex: 1, justifyContent: 'flex-end' }} imageStyle={{ opacity: 0.78 }}><View style={{ padding: 18, backgroundColor: '#00000088', gap: 4 }}><Text style={{ color: '#fff', fontSize: 26, fontWeight: '900' }}>{game.title}</Text><Text style={{ color: '#ddd' }}>{game.subtitle}</Text></View></ImageBackground></Pressable>)}</ScrollView>;
}
