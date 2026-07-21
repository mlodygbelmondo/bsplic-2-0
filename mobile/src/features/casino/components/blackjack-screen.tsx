/* eslint-disable @typescript-eslint/no-require-imports -- Metro requires static bundled asset paths. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Volume2, VolumeX } from 'lucide-react-native';

import {
  blackjackDeclineInsurance,
  blackjackDoubleDown,
  blackjackHit,
  blackjackSplit,
  blackjackStand,
  blackjackTakeInsurance,
  getBlackjackTableInfo,
  getCurrentBlackjackGame,
  placeBlackjackBet,
  type BlackjackGameState,
  type Card,
} from '@/features/casino/api/blackjack';
import { useCasinoFeedback } from '@/features/casino/hooks/use-casino-feedback';
import {
  buildFinaleSteps,
  calculateHandValue,
  maskHandsForReveal,
  wait,
} from '@/features/casino/lib/blackjackReveal';
import { useRouteActive } from '@/hooks/use-route-active';
import { useAuth } from '@/providers/auth-provider';
import { useNetwork } from '@/providers/network-provider';

const colors = {
  text: '#ffffff',
  muted: 'rgba(255,255,255,0.46)',
  gold: '#f5b942',
  red: '#ef4462',
};
const quickStakes = [10, 25, 50, 100, 250, 1000];
const suits: Record<Card['suit'], string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

function PlayingCard({ card, hidden = false, overlap = false }: { card?: Card; hidden?: boolean; overlap?: boolean }) {
  const red = card?.suit === 'hearts' || card?.suit === 'diamonds';
  const suitColor = red ? '#dc2948' : '#16181d';

  return (
    <View
      style={{
        width: 78,
        height: 112,
        marginLeft: overlap ? -20 : 0,
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: hidden ? 'rgba(245,185,66,0.45)' : 'rgba(0,0,0,0.12)',
        backgroundColor: '#ffffff',
        shadowColor: '#000000',
        shadowOpacity: 0.42,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 5 },
      }}
    >
      {hidden ? (
        <Image
          accessibilityLabel="Rewers karty"
          source={require('../../../../assets/images/casino/blackjack-card-reverse.png')}
          resizeMode="cover"
          style={{ width: '100%', height: '100%' }}
        />
      ) : (
        <View style={{ flex: 1, padding: 8, justifyContent: 'space-between' }}>
          <View style={{ alignSelf: 'flex-start', alignItems: 'center' }}>
            <Text allowFontScaling={false} style={{ color: suitColor, fontSize: 18, lineHeight: 19, fontWeight: '800' }}>{card?.rank}</Text>
            <Text allowFontScaling={false} style={{ color: suitColor, fontSize: 15, lineHeight: 16 }}>{card ? suits[card.suit] : ''}</Text>
          </View>
          <Text allowFontScaling={false} style={{ position: 'absolute', alignSelf: 'center', top: 34, color: suitColor, opacity: 0.13, fontSize: 48 }}>{card ? suits[card.suit] : ''}</Text>
          <View style={{ alignSelf: 'flex-end', alignItems: 'center', transform: [{ rotate: '180deg' }] }}>
            <Text allowFontScaling={false} style={{ color: suitColor, fontSize: 18, lineHeight: 19, fontWeight: '800' }}>{card?.rank}</Text>
            <Text allowFontScaling={false} style={{ color: suitColor, fontSize: 15, lineHeight: 16 }}>{card ? suits[card.suit] : ''}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function Hand({ cards, hiddenCount = 0 }: { cards: Card[]; hiddenCount?: number }) {
  const entries = [
    ...cards.map((card) => ({ key: card.id ?? `${card.rank}-${card.suit}`, card, hidden: false })),
    ...Array.from({ length: hiddenCount }, (_, index) => ({ key: `hidden-${index}`, card: undefined, hidden: true })),
  ];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ width: '100%' }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 12, paddingBottom: 7 }}>
      {entries.map((entry, index) => <PlayingCard key={entry.key} card={entry.card} hidden={entry.hidden} overlap={index > 0} />)}
    </ScrollView>
  );
}

function GameAction({ label, primary = false, disabled = false, onPress }: { label: string; primary?: boolean; disabled?: boolean; onPress(): void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 50,
        minWidth: 102,
        flexGrow: 1,
        paddingHorizontal: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 17,
        borderWidth: 1,
        borderColor: primary ? 'rgba(251,191,36,0.72)' : 'rgba(255,255,255,0.25)',
        backgroundColor: primary ? colors.gold : 'rgba(255,255,255,0.08)',
        opacity: disabled ? 0.38 : 1,
      }}
    >
      <Text allowFontScaling={false} style={{ color: primary ? '#15100a' : colors.text, fontSize: 16, fontWeight: primary ? '800' : '500' }}>{label}</Text>
    </Pressable>
  );
}

export function BlackjackScreen() {
  const routeActive = useRouteActive();
  const { user, profile, refreshProfile } = useAuth();
  const { canPerformWrites } = useNetwork();
  const feedback = useCasinoFeedback();
  const mountedRef = useRef(true);
  const routeActiveRef = useRef(false);
  const revealSequenceRef = useRef(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [game, setGame] = useState<BlackjackGameState | null>(null);
  const [stake, setStake] = useState('10');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [tableLabel, setTableLabel] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [next, table] = await Promise.all([
        getCurrentBlackjackGame({ userId: user!.id }),
        getBlackjackTableInfo({ userId: user!.id }),
      ]);
      setGame(next);
      setTableLabel(`${table.deckCount} talie  •  Pozostało ${table.cardsRemaining}/${table.deckCount * 52} kart  •  Shoe #${table.shoeNumber}`);
    } catch (cause) {
      Alert.alert('Blackjack', cause instanceof Error ? cause.message : 'Nie udało się wczytać stołu.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    routeActiveRef.current = routeActive;
    revealSequenceRef.current += 1;
    if (routeActive) void load();
  }, [load, routeActive]);

  useEffect(() => {
    mountedRef.current = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => {
      mountedRef.current = false;
      subscription.remove();
    };
  }, []);

  const settled = Boolean(game && ['won', 'lost', 'push'].includes(game.status));
  const activeHand = game?.playerHands[game.activeHandIndex];
  const canSplit = Boolean(game?.status === 'playing' && activeHand?.cards.length === 2 && activeHand.cards[0].rank === activeHand.cards[1].rank && game.playerHands.length < 4);
  const canDouble = Boolean(game?.status === 'playing' && activeHand?.cards.length === 2 && !activeHand.doubleDownUsed);

  const presentGame = async (next: BlackjackGameState, freshDeal = false) => {
    if (!['won', 'lost', 'push'].includes(next.status)) {
      setGame(next);
      return;
    }
    const sequence = ++revealSequenceRef.current;
    for (const step of buildFinaleSteps(next, { reducedMotion, freshDeal })) {
      await wait(step.delay);
      if (!mountedRef.current || !routeActiveRef.current || revealSequenceRef.current !== sequence) return;
      setGame(step.settle ? next : {
        ...next,
        status: 'playing',
        payout: 0,
        playerHands: maskHandsForReveal(next.playerHands),
        dealerHand: next.dealerHand.slice(0, step.dealerCards),
        dealerHiddenCount: Math.max(0, next.dealerHand.length - step.dealerCards),
      });
      if (step.settle) feedback.result(next.status === 'won');
      else feedback.card();
    }
  };

  const act = async (operation: () => Promise<BlackjackGameState>, freshDeal = false) => {
    if (!canPerformWrites) {
      Alert.alert('Brak internetu', 'Akcje kasynowe nie są kolejkowane.');
      return;
    }
    setActing(true);
    try {
      const next = await operation();
      if (routeActiveRef.current) feedback.card();
      await presentGame(next, freshDeal);
      await refreshProfile();
    } catch (cause) {
      Alert.alert('Nie udało się wykonać akcji', cause instanceof Error ? cause.message : 'Spróbuj ponownie.');
    } finally {
      if (mountedRef.current) setActing(false);
    }
  };

  const startWithStake = (stakeValue: string) => {
    const amount = Number(stakeValue.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0 || amount > Number(profile?.balance ?? 0)) {
      Alert.alert('Nieprawidłowa stawka', 'Sprawdź stawkę i saldo.');
      return;
    }
    feedback.chip();
    void act(() => placeBlackjackBet({ userId: user!.id, stake: amount }), true);
  };
  const start = () => startWithStake(stake);

  const result = useMemo(() => {
    if (!game) return null;
    if (game.status === 'won') return `Wygrana ${game.payout.toFixed(2)} zł`;
    if (game.status === 'lost') return 'Porażka';
    if (game.status === 'push') return `Remis · zwrot ${game.payout.toFixed(2)} zł`;
    return null;
  }, [game]);

  const balance = Number(profile?.balance ?? 0);
  const maxStake = Math.max(0, Math.floor(balance));

  return (
    <ImageBackground source={require('../../../../assets/images/casino/blackjack-mobile-background.webp')} resizeMode="cover" style={{ flex: 1, backgroundColor: '#050807' }}>
      <View pointerEvents="none" style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(4,5,9,0.48)' }} />
      <ScrollView style={{ flex: 1 }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 110 }}>
        <View style={{ alignItems: 'center', minHeight: 38, justifyContent: 'center', paddingHorizontal: 42 }}>
          <Text allowFontScaling={false} style={{ color: colors.muted, fontSize: 11, fontWeight: '600' }}>{tableLabel || 'Wczytywanie stołu…'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={feedback.muted ? 'Włącz dźwięki' : 'Wycisz dźwięki'} onPress={feedback.toggleMuted} style={{ position: 'absolute', right: 0, width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(0,0,0,0.35)' }}>
            {feedback.muted ? <VolumeX size={16} color="rgba(255,255,255,0.55)" /> : <Volume2 size={16} color="rgba(255,255,255,0.55)" />}
          </Pressable>
        </View>

        {game ? (
          <>
            <View style={{ minHeight: 178, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Text allowFontScaling={false} style={{ color: 'rgba(255,255,255,0.82)', backgroundColor: 'rgba(0,0,0,0.54)', borderColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 6, fontSize: 14, fontWeight: '600' }}>
                Krupier: {calculateHandValue(game.dealerHand)}{game.dealerHiddenCount > 0 && (game.status === 'playing' || game.status === 'insurance') ? ' + ?' : ''}
              </Text>
              <Hand cards={game.dealerHand} hiddenCount={game.dealerHiddenCount ?? 0} />
            </View>

            {game.status === 'insurance' ? (
              <View style={{ minHeight: 116, justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                <Text allowFontScaling={false} style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>Insurance?</Text>
                <Text allowFontScaling={false} style={{ color: colors.muted, fontSize: 13 }}>Stawka insurance: {game.insuranceStake.toFixed(2)} zł</Text>
                <View style={{ flexDirection: 'row', gap: 9, alignSelf: 'stretch' }}>
                  <GameAction label="Insurance" disabled={acting} onPress={() => void act(() => blackjackTakeInsurance({ gameId: game.id, userId: user!.id }))} />
                  <GameAction label="No Insurance" disabled={acting} onPress={() => void act(() => blackjackDeclineInsurance({ gameId: game.id, userId: user!.id }))} />
                </View>
              </View>
            ) : null}

            {game.status === 'playing' ? (
              <View style={{ minHeight: 116, justifyContent: 'center', gap: 8 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <GameAction label="Hit" disabled={acting} onPress={() => void act(() => blackjackHit({ gameId: game.id, userId: user!.id }))} />
                  <GameAction label="Stand" primary disabled={acting} onPress={() => void act(() => blackjackStand({ gameId: game.id, userId: user!.id }))} />
                  {canSplit ? <GameAction label="Split" disabled={acting} onPress={() => void act(() => blackjackSplit({ gameId: game.id, userId: user!.id }))} /> : null}
                </View>
                {canDouble ? (
                  <View style={{ alignItems: 'center' }}>
                    <View style={{ width: canSplit ? 146 : '100%' }}>
                      <GameAction label="Double Down" disabled={acting} onPress={() => void act(() => blackjackDoubleDown({ gameId: game.id, userId: user!.id }))} />
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}

            {settled ? (
              <View style={{ minHeight: 116, justifyContent: 'center', alignItems: 'center', gap: 10 }}>
                <Text allowFontScaling={false} style={{ color: game.status === 'won' ? '#4ade80' : game.status === 'lost' ? colors.red : colors.text, fontSize: 28, fontWeight: '900', textTransform: 'uppercase' }}>{result}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <GameAction label={`Graj ponownie (${game.initialStake.toFixed(0)} zł)`} primary disabled={acting || game.initialStake > balance} onPress={() => { const nextStake = String(game.initialStake); setStake(nextStake); startWithStake(nextStake); }} />
                  <GameAction label="Zmień stawkę" disabled={acting} onPress={() => setGame(null)} />
                </View>
                <Pressable onPress={() => void Share.share({ message: `Blackjack BSPLIC: ${result}. https://bsplic.vercel.app/casino/blackjack` })} style={{ padding: 7 }}><Text style={{ color: colors.muted, fontSize: 12 }}>Udostępnij wynik</Text></Pressable>
              </View>
            ) : null}

            <View style={{ minHeight: 198, justifyContent: 'center' }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, gap: 12, paddingHorizontal: 4 }}>
                {game.playerHands.map((hand, index) => (
                  <View key={hand.id} style={{ minWidth: game.playerHands.length > 1 ? 260 : 354, alignItems: 'center', justifyContent: 'center', opacity: game.playerHands.length > 1 && game.status === 'playing' && index !== game.activeHandIndex ? 0.5 : 1 }}>
                    <Hand cards={hand.cards} />
                    <Text allowFontScaling={false} style={{ color: colors.text, backgroundColor: 'rgba(0,0,0,0.56)', borderColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, fontSize: 16, fontWeight: '700' }}>Ty: {calculateHandValue(hand.cards)}</Text>
                    <Text allowFontScaling={false} style={{ color: colors.muted, fontSize: 13, marginTop: 8 }}>Stawka: {hand.stake.toFixed(2)} zł</Text>
                  </View>
                ))}
              </ScrollView>
              <Text allowFontScaling={false} style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', marginTop: 4 }}>Łączna stawka: {game.stake.toFixed(2)} zł</Text>
            </View>
          </>
        ) : (
          <View style={{ flex: 1, minHeight: 490, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ width: '100%', maxWidth: 360, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, gap: 12 }}>
              <Text allowFontScaling={false} style={{ color: colors.text, fontSize: 20, fontWeight: '800', textAlign: 'center' }}>{loading ? 'Wczytywanie…' : 'Rozpocznij rozdanie'}</Text>
              <View style={{ flexDirection: 'row', gap: 5 }}>
                {quickStakes.map((value) => (
                  <Pressable key={value} disabled={value > balance} onPress={() => setStake(String(value))} style={{ flex: 1, minHeight: 38, borderRadius: 999, borderWidth: 1, borderColor: Number(stake) === value ? 'rgba(251,191,36,0.7)' : 'rgba(255,255,255,0.15)', backgroundColor: Number(stake) === value ? 'rgba(251,191,36,0.18)' : 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', opacity: value > balance ? 0.35 : 1 }}><Text allowFontScaling={false} style={{ color: Number(stake) === value ? '#fde7a5' : 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '800' }}>{value}</Text></Pressable>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 5 }}>
                {[['MIN', 1], ['1/4', Math.max(1, Math.floor(balance / 4))], ['1/2', Math.max(1, Math.floor(balance / 2))], ['x2', Math.min(Math.max(1, Number(stake) * 2), maxStake)], ['x4', Math.min(Math.max(1, Number(stake) * 4), maxStake)], ['MAX', maxStake]].map(([label, value]) => (
                  <Pressable key={String(label)} disabled={balance < 1} onPress={() => setStake(String(value))} style={{ flex: 1, minHeight: 38, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', opacity: balance < 1 ? 0.35 : 1 }}><Text allowFontScaling={false} style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '800' }}>{label}</Text></Pressable>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput accessibilityLabel="Stawka" keyboardType="decimal-pad" value={stake} onChangeText={setStake} style={{ flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(0,0,0,0.4)', color: colors.text, textAlign: 'center', fontSize: 18 }} />
                <Pressable accessibilityRole="button" accessibilityLabel="Graj" disabled={acting || !canPerformWrites} onPress={start} style={({ pressed }) => ({ flex: 1, minHeight: 48, borderRadius: 12, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', opacity: acting || !canPerformWrites ? 0.45 : pressed ? 0.82 : 1 })}><Text allowFontScaling={false} style={{ color: '#15100a', fontSize: 16, fontWeight: '800' }}>Graj</Text></Pressable>
              </View>
              <Text allowFontScaling={false} style={{ color: colors.muted, fontSize: 13, textAlign: 'center' }}>Saldo: {balance.toFixed(2)} zł</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </ImageBackground>
  );
}
