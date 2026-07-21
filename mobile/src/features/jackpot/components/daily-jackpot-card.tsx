/* eslint-disable @typescript-eslint/no-require-imports -- Metro resolves bundled artwork through static require calls. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Alert, AppState, Pressable, Text, View } from 'react-native';

import { buyDailyJackpotTicket, getDailyJackpotState } from '@/features/jackpot/api/jackpot';
import { formatJackpotAmount, getDrawTimeLabel } from '@/features/jackpot/lib/jackpotFormat';
import { useAuth } from '@/providers/auth-provider';
import { useNetwork } from '@/providers/network-provider';
import type { DailyJackpotSnapshot } from '@/features/jackpot/types';

export function DailyJackpotCard({ enabled = true }: { enabled?: boolean }) {
  const { profile, refreshProfile } = useAuth();
  const { canPerformWrites } = useNetwork();
  const [snapshot, setSnapshot] = useState<DailyJackpotSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const load = useCallback(() => void getDailyJackpotState().then(setSnapshot).catch(() => setSnapshot(null)), []);

  useEffect(() => {
    if (!enabled) return;
    load();
    const timer = setInterval(load, 15_000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') load(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [enabled, load]);

  useEffect(() => {
    setElapsedSeconds(0);
    if (snapshot?.status !== 'collecting') return;
    const timer = setInterval(() => setElapsedSeconds(value => value + 1), 1_000);
    return () => clearInterval(timer);
  }, [snapshot?.drawScheduledAt, snapshot?.serverNow, snapshot?.status]);

  const countdown = useMemo(() => {
    if (!snapshot?.drawScheduledAt || !snapshot.serverNow) return '00:00:00';
    const remaining = new Date(snapshot.drawScheduledAt).getTime() - new Date(snapshot.serverNow).getTime() - elapsedSeconds * 1_000;
    const totalSeconds = Math.max(0, Math.floor(remaining / 1_000));
    const hours = Math.floor(totalSeconds / 3_600);
    const minutes = Math.floor((totalSeconds % 3_600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':');
  }, [elapsedSeconds, snapshot?.drawScheduledAt, snapshot?.serverNow]);

  if (!snapshot?.poolId) return null;
  const canDraw = snapshot.status === 'drawn' || (snapshot.status === 'rolled_over' && snapshot.currentUserHasTicket);
  const limit = snapshot.currentUserTicketCount >= snapshot.maxTicketsPerPlayer;
  const insufficientBalance = Number(profile?.balance ?? 0) < snapshot.ticketPrice;
  const rolledOver = snapshot.status === 'rolled_over';
  const canBuy = snapshot.status === 'collecting' && !limit && !insufficientBalance && !loading && canPerformWrites;
  const actionEnabled = canDraw || canBuy;
  const statusLabel = snapshot.status === 'collecting'
    ? `${getDrawTimeLabel(snapshot.drawScheduledAt, snapshot.serverNow)} · ${countdown}`
    : snapshot.status === 'locked'
      ? 'Losowanie trwa'
      : snapshot.status === 'drawn'
        ? snapshot.currentUserHasTicket ? 'Wynik gotowy do obejrzenia' : 'Losowanie zakończone'
        : rolledOver ? 'Pula przechodzi dalej' : 'Pula anulowana';
  const buttonLabel = canDraw
    ? rolledOver ? 'Zobacz rozliczenie  →' : snapshot.currentUserHasTicket ? 'Przejdź do losowania  →' : 'Obejrzyj losowanie  →'
    : snapshot.status === 'locked' ? 'Losowanie trwa'
      : snapshot.status === 'drawn' ? 'Finał zakończony'
        : rolledOver ? 'Pula przechodzi dalej'
          : snapshot.status === 'cancelled' ? 'Pula anulowana'
            : limit ? 'Limit ticketów wykorzystany'
              : insufficientBalance ? 'Brak środków na ticket'
                : loading ? 'Kupowanie…'
                  : snapshot.currentUserTicketCount === 1 ? 'Kup drugi ticket' : 'Kup ticket';

  const buy = async () => {
    if (!canPerformWrites) { Alert.alert('Brak internetu', 'Zakup ticketu wymaga połączenia.'); return; }
    setLoading(true);
    try { setSnapshot(await buyDailyJackpotTicket(snapshot.poolId!)); await refreshProfile(); }
    catch (cause) { Alert.alert('Jackpot', cause instanceof Error ? cause.message : 'Nie udało się kupić ticketu.'); }
    finally { setLoading(false); }
  };

  return <View
    style={{ marginHorizontal: 12, minHeight: rolledOver ? 218 : 194, overflow: 'hidden', borderRadius: 14, borderWidth: 1, borderColor: '#D6692F', backgroundColor: '#5A1C16', padding: 14, justifyContent: 'space-between' }}
  >
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(37,0,8,0.42)' }} />
    <Image pointerEvents="none" source={require('../../../../assets/images/jackpot/daily-jackpot-prizes.png')} contentFit="contain" style={{ position: 'absolute', width: 210, height: 148, right: -28, top: -9, opacity: 0.48 }} />
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <View style={{ gap: 1 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Text style={{ color: '#FAD0C0', fontSize: 9, fontWeight: '800' }}>PULA</Text><Pressable accessibilityRole="button" accessibilityLabel="Skąd bierze się Jackpot?" onPress={() => Alert.alert('Skąd bierze się Jackpot?', 'Pula Jackpotu bierze się z 20% stawek przegranych kuponów z poprzedniego dnia oraz z kupionych ticketów w aktualnym losowaniu. Im większy ruch w grze, tym większa pula do zgarnięcia.')} hitSlop={8}><Text style={{ color: '#FAD0C0', fontSize: 10 }}>ⓘ</Text></Pressable></View><Text style={{ color: '#FFFFFF', fontSize: 31, lineHeight: 36, fontWeight: '900' }}>{formatHeroAmount(snapshot.prizeAmount)}</Text></View>
      <View style={{ borderRadius: 999, backgroundColor: '#160B0BCC', paddingHorizontal: 10, paddingVertical: 6 }}><Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>◷ {statusLabel}</Text></View>
    </View>

    <View style={{ flexDirection: 'row', borderRadius: 10, overflow: 'hidden', backgroundColor: '#160B0BCC' }}>
      <JackpotStat label="CENA" value={formatJackpotAmount(snapshot.ticketPrice)} />
      <JackpotStat label="TWOJE TICKETY" value={snapshot.currentUserTicketNumbers.length ? snapshot.currentUserTicketNumbers.map(number => `#${String(number).padStart(2, '0')}`).join(' ') : '—'} bordered />
      <JackpotStat label="LIMIT" value={`Maks. ${snapshot.maxTicketsPerPlayer}`} />
    </View>

    <Text accessibilityLabel={`Minimum ${snapshot.minUniqueUsers} graczy`} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}>Minimum {snapshot.minUniqueUsers} graczy</Text>
    {rolledOver ? <Text style={{ color: '#FFD7C8', fontSize: 10, fontWeight: '700', textAlign: 'center' }}>Za mało uczestników. Ticket zwrócony, pula przechodzi na jutro.</Text> : null}

    <Pressable
      disabled={!actionEnabled}
      onPress={() => canDraw ? router.push(`/jackpot/draw/${snapshot.poolId}`) : canBuy ? void buy() : undefined}
      style={{ borderRadius: 10, opacity: actionEnabled ? 1 : 0.62 }}
    >
      <View style={{ minHeight: 43, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: actionEnabled ? '#FFE14A' : '#C9A95D' }}><Text style={{ color: '#21120B', fontSize: 13, fontWeight: '900' }}>{buttonLabel}</Text></View>
    </Pressable>
  </View>;
}

function formatHeroAmount(amount: number) {
  const safe = Number.isFinite(amount) ? amount : 0;
  const hasCents = Math.round(safe) !== safe;
  return `${safe.toLocaleString('pl-PL', { minimumFractionDigits: hasCents ? 2 : 0, maximumFractionDigits: hasCents ? 2 : 0 })} zł`;
}

function JackpotStat({ label, value, bordered = false }: { label: string; value: string; bordered?: boolean }) {
  return <View style={{ flex: 1, minHeight: 49, alignItems: 'center', justifyContent: 'center', borderLeftWidth: bordered ? 1 : 0, borderRightWidth: bordered ? 1 : 0, borderColor: '#FFFFFF22' }}><Text style={{ color: '#EBC9BE', fontSize: 7, fontWeight: '800' }}>{label}</Text><Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '900' }}>{value}</Text></View>;
}
