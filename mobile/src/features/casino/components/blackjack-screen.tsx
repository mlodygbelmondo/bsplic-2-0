import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Pressable, ScrollView, Share, Text, View } from 'react-native';

import { AppButton, AppCard, AppInput } from '@/components/ui';
import { blackjackDeclineInsurance, blackjackDoubleDown, blackjackHit, blackjackSplit, blackjackStand, blackjackTakeInsurance, getBlackjackTableInfo, getCurrentBlackjackGame, placeBlackjackBet, type BlackjackGameState, type Card } from '@/features/casino/api/blackjack';
import { buildFinaleSteps, calculateHandValue, maskHandsForReveal, wait } from '@/features/casino/lib/blackjackReveal';
import { useAuth } from '@/providers/auth-provider';
import { useNetwork } from '@/providers/network-provider';
import { useCasinoFeedback } from '@/features/casino/hooks/use-casino-feedback';
import { useRouteActive } from '@/hooks/use-route-active';

const c = { bg: '#070b09', felt: '#063f2b', card: '#101713', border: '#2b4f3c', text: '#fff', muted: '#a9b9af', gold: '#ffe14a', red: '#ef4462' };
const suits: Record<Card['suit'], string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
function PlayingCard({ card, hidden = false }: { card?: Card; hidden?: boolean }) { return <View style={{ width: 58, height: 82, borderRadius: 8, borderWidth: 2, borderColor: hidden ? '#e8b83e' : '#ddd', backgroundColor: hidden ? '#8d082c' : '#fff', padding: 6, justifyContent: hidden ? 'center' : 'space-between' }}>{hidden ? <Text style={{ color: '#fff', fontSize: 24, textAlign: 'center' }}>◆</Text> : <><Text style={{ color: card?.suit === 'hearts' || card?.suit === 'diamonds' ? '#d7193f' : '#111', fontWeight: '900' }}>{card?.rank}</Text><Text style={{ color: card?.suit === 'hearts' || card?.suit === 'diamonds' ? '#d7193f' : '#111', fontSize: 24, textAlign: 'center' }}>{card ? suits[card.suit] : ''}</Text></>}</View>; }
function Hand({ cards, hiddenCount = 0 }: { cards: Card[]; hiddenCount?: number }) { return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minHeight: 84, gap: 6 }}>{cards.map((card, index) => <PlayingCard key={card.id ?? `${card.rank}-${card.suit}-${index}`} card={card} />)}{Array.from({ length: hiddenCount }, (_, index) => <PlayingCard key={`hidden-${index}`} hidden />)}</ScrollView>; }

export function BlackjackScreen() {
  const routeActive = useRouteActive();
  const { user, profile, refreshProfile } = useAuth(); const { canPerformWrites } = useNetwork();
  const feedback = useCasinoFeedback();
  const mountedRef = useRef(true);
  const routeActiveRef = useRef(false);
  const revealSequenceRef = useRef(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [game, setGame] = useState<BlackjackGameState | null>(null); const [stake, setStake] = useState('10'); const [loading, setLoading] = useState(true); const [acting, setActing] = useState(false); const [tableLabel, setTableLabel] = useState('');
  const load = useCallback(async () => { setLoading(true); try { const [next, table] = await Promise.all([getCurrentBlackjackGame({ userId: user!.id }), getBlackjackTableInfo({ userId: user!.id })]); setGame(next); setTableLabel(`${table.deckCount} talie · ${table.cardsRemaining} kart · but #${table.shoeNumber}`); } catch (cause) { Alert.alert('Blackjack', cause instanceof Error ? cause.message : 'Nie udało się wczytać stołu.'); } finally { setLoading(false); } }, [user]);
  useEffect(() => {
    routeActiveRef.current = routeActive;
    revealSequenceRef.current += 1;
    if (routeActive) void load();
  }, [load, routeActive]);
  useEffect(() => {
    mountedRef.current = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => { mountedRef.current = false; subscription.remove(); };
  }, []);
  const settled = game && ['won', 'lost', 'push'].includes(game.status);
  const activeHand = game?.playerHands[game.activeHandIndex];
  const canSplit = Boolean(game?.status === 'playing' && activeHand?.cards.length === 2 && activeHand.cards[0].rank === activeHand.cards[1].rank && game.playerHands.length < 4);
  const canDouble = Boolean(game?.status === 'playing' && activeHand?.cards.length === 2 && !activeHand.doubleDownUsed);
  const presentGame = async (next: BlackjackGameState, freshDeal = false) => {
    if (!['won', 'lost', 'push'].includes(next.status)) { setGame(next); return; }
    const sequence = ++revealSequenceRef.current;
    for (const step of buildFinaleSteps(next, { reducedMotion, freshDeal })) {
      await wait(step.delay);
      if (!mountedRef.current || !routeActiveRef.current || revealSequenceRef.current !== sequence) return;
      setGame(step.settle ? next : { ...next, status: 'playing', payout: 0, playerHands: maskHandsForReveal(next.playerHands), dealerHand: next.dealerHand.slice(0, step.dealerCards), dealerHiddenCount: Math.max(0, next.dealerHand.length - step.dealerCards) });
      if (step.settle) feedback.result(next.status === 'won');
      else feedback.card();
    }
  };
  const act = async (operation: () => Promise<BlackjackGameState>, freshDeal = false) => { if (!canPerformWrites) { Alert.alert('Brak internetu', 'Akcje kasynowe nie są kolejkowane.'); return; } setActing(true); try { const next = await operation(); if (routeActiveRef.current) feedback.card(); await presentGame(next, freshDeal); await refreshProfile(); } catch (cause) { Alert.alert('Nie udało się wykonać akcji', cause instanceof Error ? cause.message : 'Spróbuj ponownie.'); } finally { if (mountedRef.current) setActing(false); } };
  const start = () => { const amount = Number(stake.replace(',', '.')); if (!Number.isFinite(amount) || amount <= 0 || amount > Number(profile?.balance ?? 0)) { Alert.alert('Nieprawidłowa stawka', 'Sprawdź stawkę i saldo.'); return; } feedback.chip(); void act(() => placeBlackjackBet({ userId: user!.id, stake: amount }), true); };
  const result = useMemo(() => !game ? null : game.status === 'won' ? `Wygrana ${game.payout.toFixed(2)} zł` : game.status === 'lost' ? 'Przegrana' : game.status === 'push' ? `Remis · zwrot ${game.payout.toFixed(2)} zł` : null, [game]);
  return <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 12, paddingBottom: 116, gap: 12 }}>
    <View style={{ alignItems: 'center', gap: 4, paddingVertical: 8 }}><Text style={{ color: c.gold, fontSize: 11, letterSpacing: 2, fontWeight: '900' }}>STÓŁ PRYWATNY</Text><Text style={{ color: c.text, fontSize: 28, fontWeight: '900' }}>Blackjack</Text><Text style={{ color: c.muted }}>{tableLabel || 'Wczytywanie stołu…'}</Text></View>
    <AppCard style={{ minHeight: 360, backgroundColor: c.felt, borderColor: '#9c7626', borderWidth: 3, borderRadius: 100, padding: 24, gap: 18 }}>
      <View style={{ gap: 7 }}><Text style={{ color: c.muted, fontSize: 11, fontWeight: '900' }}>KRUPIER {game && game.status !== 'playing' && game.status !== 'insurance' ? `· ${calculateHandValue(game.dealerHand)}` : ''}</Text><Hand cards={game?.dealerHand ?? []} hiddenCount={game?.dealerHiddenCount ?? 0} /></View>
      <View style={{ height: 1, backgroundColor: '#ffffff22' }} />
      {(game?.playerHands ?? []).map((hand, index) => <View key={hand.id} style={{ gap: 7, borderRadius: 13, borderWidth: index === game?.activeHandIndex && game?.status === 'playing' ? 2 : 0, borderColor: c.gold, padding: index === game?.activeHandIndex ? 8 : 0 }}><Text style={{ color: index === game?.activeHandIndex ? c.gold : c.muted, fontSize: 11, fontWeight: '900' }}>TWOJA RĘKA {(game?.playerHands.length ?? 0) > 1 ? index + 1 : ''} · {calculateHandValue(hand.cards)} · {hand.stake.toFixed(2)} zł</Text><Hand cards={hand.cards} /></View>)}
      {!game && <View style={{ flex: 1, justifyContent: 'center' }}><Text style={{ color: c.text, textAlign: 'center', fontSize: 20, fontWeight: '900' }}>{loading ? 'Wczytywanie…' : 'Postaw stawkę, aby rozpocząć'}</Text></View>}
      {result && <><Text style={{ color: game?.status === 'won' ? c.gold : game?.status === 'lost' ? c.red : c.text, textAlign: 'center', fontSize: 24, fontWeight: '900' }}>{game?.status === 'won' ? '🎉 ' : ''}{result}</Text><AppButton variant="ghost" onPress={() => void Share.share({ message: `Blackjack BSPLIC: ${result}. https://bsplic.vercel.app/casino/blackjack` })}>Udostępnij wynik</AppButton></>}
    </AppCard>
    {(!game || settled) && <AppCard style={{ backgroundColor: c.card, borderColor: c.border, gap: 12 }}><AppInput label="Stawka" keyboardType="decimal-pad" value={stake} onChangeText={setStake} helperText={`Saldo: ${Number(profile?.balance ?? 0).toFixed(2)} zł`} /><View style={{ flexDirection: 'row', gap: 7 }}>{[10,25,50,100].map(value => <Pressable key={value} onPress={() => setStake(String(value))} style={{ flex: 1, minHeight: 42, borderRadius: 10, backgroundColor: c.felt, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c.gold, fontWeight: '900' }}>{value}</Text></Pressable>)}</View><AppButton loading={acting} disabled={!canPerformWrites} onPress={start}>{settled ? 'Nowa gra' : 'Rozdaj karty'}</AppButton></AppCard>}
    {game?.status === 'insurance' && <AppCard style={{ backgroundColor: c.card, borderColor: c.gold, gap: 12 }}><Text style={{ color: c.text, fontSize: 18, fontWeight: '900' }}>Krupier pokazuje asa</Text><Text style={{ color: c.muted }}>Ubezpieczenie kosztuje {game.insuranceStake.toFixed(2)} zł.</Text><View style={{ flexDirection: 'row', gap: 8 }}><AppButton style={{ flex: 1 }} loading={acting} onPress={() => void act(() => blackjackTakeInsurance({ gameId: game.id, userId: user!.id }))}>Ubezpiecz</AppButton><AppButton style={{ flex: 1 }} variant="outline" disabled={acting} onPress={() => void act(() => blackjackDeclineInsurance({ gameId: game.id, userId: user!.id }))}>Pomiń</AppButton></View></AppCard>}
    {game?.status === 'playing' && <AppCard style={{ backgroundColor: c.card, borderColor: c.border, gap: 9 }}><View style={{ flexDirection: 'row', gap: 8 }}><AppButton style={{ flex: 1 }} loading={acting} onPress={() => void act(() => blackjackHit({ gameId: game.id, userId: user!.id }))}>Dobierz</AppButton><AppButton style={{ flex: 1 }} variant="outline" disabled={acting} onPress={() => void act(() => blackjackStand({ gameId: game.id, userId: user!.id }))}>Stój</AppButton></View><View style={{ flexDirection: 'row', gap: 8 }}><AppButton style={{ flex: 1 }} variant="secondary" disabled={acting || !canDouble} onPress={() => void act(() => blackjackDoubleDown({ gameId: game.id, userId: user!.id }))}>Podwój</AppButton><AppButton style={{ flex: 1 }} variant="secondary" disabled={acting || !canSplit} onPress={() => void act(() => blackjackSplit({ gameId: game.id, userId: user!.id }))}>Rozdziel</AppButton></View></AppCard>}
  </ScrollView>;
}
