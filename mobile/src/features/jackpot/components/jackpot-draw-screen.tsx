/* eslint-disable @typescript-eslint/no-require-imports -- Metro resolves bundled artwork through static require calls. */
import { useCallback, useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ChevronLeft, Ticket } from 'lucide-react-native';
import { Alert, AppState, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppAvatar, AppButton, AppCard } from '@/components/ui';
import { claimDailyJackpotReward, getDailyJackpotDraw, revealDailyJackpotDraw } from '@/features/jackpot/api/jackpot';
import { formatJackpotAmount } from '@/features/jackpot/lib/jackpotFormat';
import { useRouteActive } from '@/hooks/use-route-active';
import { useAuth } from '@/providers/auth-provider';
import { useNetwork } from '@/providers/network-provider';
import type { DailyJackpotDraw } from '@/features/jackpot/types';

export function JackpotDrawScreen({ roundId }: { roundId: string }) {
  const routeActive = useRouteActive();
  const { canPerformWrites } = useNetwork();
  const { user, refreshProfile, updateProfileBalance } = useAuth();
  const [draw, setDraw] = useState<DailyJackpotDraw | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealing, setRevealing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setDraw(await getDailyJackpotDraw(roundId)); }
    catch (cause) { Alert.alert('Jackpot', cause instanceof Error ? cause.message : 'Nie znaleziono losowania.'); }
    finally { setLoading(false); }
  }, [roundId]);

  useEffect(() => {
    if (!routeActive) return;
    void load();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void load(); });
    return () => subscription.remove();
  }, [load, routeActive]);

  const reveal = async () => {
    if (!canPerformWrites) { Alert.alert('Brak internetu', 'Odsłonięcie wyniku wymaga połączenia i nie jest kolejkowane offline.'); return; }
    setRevealing(true);
    try { setDraw(await revealDailyJackpotDraw(roundId)); }
    catch (cause) { Alert.alert('Losowanie', cause instanceof Error ? cause.message : 'Nie udało się odsłonić wyniku.'); }
    finally { setRevealing(false); }
  };

  const claim = async () => {
    if (!canPerformWrites) { Alert.alert('Brak internetu', 'Odbiór nagrody wymaga połączenia i nie jest kolejkowany offline.'); return; }
    setRevealing(true);
    try {
      const result = await claimDailyJackpotReward(roundId);
      updateProfileBalance(result.balanceAfter);
      await refreshProfile();
      setDraw(await getDailyJackpotDraw(roundId));
      Alert.alert('Gratulacje!', `Odebrano ${formatJackpotAmount(result.amount)}.`);
    } catch (cause) { Alert.alert('Nagroda', cause instanceof Error ? cause.message : 'Nie udało się odebrać nagrody.'); }
    finally { setRevealing(false); }
  };

  if (loading || !draw) return <View style={styles.loading}><Text style={styles.muted}>Przygotowujemy losowanie…</Text></View>;

  return (
    <ImageBackground source={require('../../../../assets/images/casino/roulette-mobile-background.webp')} resizeMode="cover" style={styles.background}>
      <View pointerEvents="none" style={styles.backdrop} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Topbar poolDate={draw.poolDate} />
        {draw.status === 'rolled_over' ? <RolledOverDraw draw={draw} /> : <CompletedDraw draw={draw} currentUserId={user?.id} revealing={revealing} canPerformWrites={canPerformWrites} onReveal={reveal} onClaim={claim} />}
      </ScrollView>
    </ImageBackground>
  );
}

function Topbar({ poolDate }: { poolDate: string }) {
  return <View style={styles.topbar}><Pressable accessibilityRole="button" accessibilityLabel="Wróć" onPress={() => router.back()} style={styles.backButton}><ChevronLeft color="#FFE1A0" size={20} /></Pressable><Text style={styles.topbarText}>Losowanie z {formatNumericDate(poolDate)}</Text></View>;
}

function RolledOverDraw({ draw }: { draw: DailyJackpotDraw }) {
  return <>
    <AppCard style={styles.shellCard}>
      <Text style={styles.heroTitle}>Pula przeszła na kolejny dzień</Text>
      <Text style={styles.heroSubtitle}>{formatLongDate(draw.poolDate)}, pula <Text style={styles.whiteBold}>{formatHeroAmount(draw.prizeAmount)}</Text></Text>
      <View style={styles.metaRow}><Meta label="Graczy" value={String(draw.participantCount)} /><Meta label="Ticketów" value={String(draw.ticketCount)} /><Meta label="Finał" value="20:00" /></View>
    </AppCard>
    <AppCard style={styles.stageCard}>
      <View style={styles.resultIcon}><Ticket color="#21120B" size={28} /></View>
      <Text style={styles.resultLabel}>BRAK LOSOWANIA</Text>
      <Text style={styles.resultTitle}>Pula została przeniesiona</Text>
      <Text style={styles.resultCopy}>Tickety z tej rundy zostały rozliczone bez reveal i claim.</Text>
    </AppCard>
  </>;
}

function CompletedDraw({ draw, currentUserId, revealing, canPerformWrites, onReveal, onClaim }: { draw: DailyJackpotDraw; currentUserId?: string; revealing: boolean; canPerformWrites: boolean; onReveal(): Promise<void>; onClaim(): Promise<void> }) {
  const resultVisible = Boolean(draw.resultViewedAt || draw.winningTicketNumber !== null);
  const currentTickets = draw.participants.find(participant => participant.userId === currentUserId)?.ticketNumbers ?? [];
  return <>
    <AppCard style={styles.shellCard}>
      <View style={styles.metaGrid}><Meta label="Pula" value={formatHeroAmount(draw.prizeAmount)} /><Meta label="Data losowania" value={formatLongDate(draw.poolDate)} subvalue="20:00" /><Meta label="Graczy" value={String(draw.participantCount)} /><Meta label="Ticketów" value={String(draw.ticketCount)} /></View>
      {currentTickets.length ? <View style={styles.userTickets}><Text style={styles.userTicketsLabel}>TWOJE TICKETY</Text><Text style={styles.userTicketsValue}>{currentTickets.map(number => `#${String(number).padStart(2, '0')}`).join(' ')}</Text></View> : null}
    </AppCard>
    <AppCard style={styles.stageCard}>
      <Text style={styles.stageTitle}>◆  TICKETY W PULI  ◆</Text>
      <Image source={require('../../../../assets/images/jackpot/jackpot-draw-stage.png')} contentFit="contain" style={styles.stageAsset} />
      <Text style={styles.resultLabel}>{resultVisible ? 'WYLOSOWANY TICKET' : 'WYNIK CZEKA'}</Text>
      <Text style={styles.ticketNumber}>{resultVisible && draw.winningTicketNumber !== null ? `#${String(draw.winningTicketNumber).padStart(2, '0')}` : '?'}</Text>
      {!resultVisible ? <AppButton loading={revealing} disabled={!canPerformWrites} onPress={() => void onReveal()}>Odsłoń wynik</AppButton> : null}
      {resultVisible && draw.winnerUsername ? <View style={styles.winner}><AppAvatar name={draw.winnerUsername} source={draw.winnerAvatarUrl ? { uri: draw.winnerAvatarUrl } : undefined} size={52} /><Text style={styles.winnerName}>{draw.winnerUsername}</Text></View> : null}
      {draw.currentUserIsWinner && draw.rewardCreditStatus === 'pending' ? <AppButton loading={revealing} disabled={!canPerformWrites} onPress={() => void onClaim()}>Odbierz {formatJackpotAmount(draw.prizeAmount)}</AppButton> : null}
    </AppCard>
    <AppCard style={styles.rosterCard}><Text style={styles.rosterTitle}>Uczestnicy</Text>{draw.participants.map(player => <View key={player.userId} style={styles.rosterRow}><Text style={styles.white}>{player.username}</Text><Text style={styles.muted}>{player.ticketNumbers.map(number => `#${String(number).padStart(2, '0')}`).join(' ')}</Text></View>)}</AppCard>
  </>;
}

function Meta({ label, value, subvalue }: { label: string; value: string; subvalue?: string }) {
  return <View style={styles.meta}><Text style={styles.metaLabel}>{label}</Text><Text style={styles.metaValue}>{value}</Text>{subvalue ? <Text style={styles.metaSubvalue}>{subvalue}</Text> : null}</View>;
}

function formatNumericDate(value: string) { return new Date(value).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
function formatLongDate(value: string) { return new Date(value).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }); }
function formatHeroAmount(amount: number) { const safe = Number.isFinite(amount) ? amount : 0; const cents = Math.round(safe) !== safe; return `${safe.toLocaleString('pl-PL', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 })} zł`; }

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#09090B' },
  backdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.72)' },
  scroll: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 44, gap: 12 },
  loading: { flex: 1, backgroundColor: '#090005', alignItems: 'center', justifyContent: 'center' },
  topbar: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#ffffff22', backgroundColor: '#00000066', alignItems: 'center', justifyContent: 'center' },
  topbarText: { color: '#AAA3A7', fontSize: 12, fontWeight: '700' },
  shellCard: { gap: 12, borderColor: '#ffffff24', backgroundColor: 'rgba(12,8,10,0.88)', padding: 14 },
  heroTitle: { color: '#FFFFFF', fontSize: 24, lineHeight: 28, fontWeight: '900' },
  heroSubtitle: { color: '#C8C0C4', fontSize: 13 },
  whiteBold: { color: '#FFFFFF', fontWeight: '800' },
  metaRow: { flexDirection: 'row', gap: 7 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  meta: { flex: 1, minWidth: '30%', minHeight: 62, borderRadius: 10, borderWidth: 1, borderColor: '#ffffff18', backgroundColor: '#090909DD', alignItems: 'center', justifyContent: 'center', padding: 8 },
  metaLabel: { color: '#AAA3A7', fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  metaValue: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', textAlign: 'center' },
  metaSubvalue: { color: '#C8C0C4', fontSize: 10 },
  userTickets: { flexDirection: 'row', alignSelf: 'center', gap: 8, borderRadius: 999, borderWidth: 1, borderColor: '#FFE14A44', backgroundColor: '#050505AA', paddingHorizontal: 12, paddingVertical: 8 },
  userTicketsLabel: { color: '#BDB3B8', fontSize: 10, fontWeight: '800' },
  userTicketsValue: { color: '#FFE14A', fontSize: 12, fontWeight: '900' },
  stageCard: { minHeight: 292, alignItems: 'center', justifyContent: 'center', gap: 10, overflow: 'hidden', borderColor: '#D1953930', backgroundColor: 'rgba(5,4,4,0.90)', padding: 20 },
  stageTitle: { color: '#FFC955', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  stageAsset: { position: 'absolute', width: '112%', height: 210, opacity: 0.22 },
  resultIcon: { width: 60, height: 60, borderRadius: 16, backgroundColor: '#FFE14A', alignItems: 'center', justifyContent: 'center' },
  resultLabel: { color: '#FFE3A4', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  resultTitle: { color: '#FFFFFF', fontSize: 25, lineHeight: 29, fontWeight: '900', textAlign: 'center' },
  resultCopy: { color: '#C8C0C4', fontSize: 13, lineHeight: 19, fontWeight: '600', textAlign: 'center' },
  ticketNumber: { color: '#FFFFFF', fontSize: 54, fontWeight: '900' },
  winner: { alignItems: 'center', gap: 7 },
  winnerName: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  rosterCard: { borderColor: '#ffffff1F', backgroundColor: 'rgba(10,7,9,0.92)', gap: 10 },
  rosterTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  rosterRow: { flexDirection: 'row', justifyContent: 'space-between' },
  white: { color: '#FFFFFF' },
  muted: { color: '#C8C0C4' },
});
