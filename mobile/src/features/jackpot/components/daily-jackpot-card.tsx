/* eslint-disable @typescript-eslint/no-require-imports -- Metro resolves bundled artwork through static require calls. */
import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Alert, AppState, ImageBackground, Pressable, Text, View } from 'react-native';

import { buyDailyJackpotTicket, getDailyJackpotState } from '@/features/jackpot/api/jackpot';
import { formatJackpotAmount } from '@/features/jackpot/lib/jackpotFormat';
import { useAuth } from '@/providers/auth-provider';
import { useNetwork } from '@/providers/network-provider';
import type { DailyJackpotSnapshot } from '@/features/jackpot/types';

export function DailyJackpotCard({ enabled = true }: { enabled?: boolean }) {
  const { profile, refreshProfile } = useAuth();
  const { canPerformWrites } = useNetwork();
  const [snapshot, setSnapshot] = useState<DailyJackpotSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(() => void getDailyJackpotState().then(setSnapshot).catch(() => setSnapshot(null)), []);

  useEffect(() => {
    if (!enabled) return;
    load();
    const timer = setInterval(load, 15_000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') load(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [enabled, load]);

  if (!snapshot?.poolId) return null;
  const canDraw = snapshot.status === 'drawn' || snapshot.status === 'rolled_over';
  const limit = snapshot.currentUserTicketCount >= snapshot.maxTicketsPerPlayer;
  const insufficientBalance = Number(profile?.balance ?? 0) < snapshot.ticketPrice;
  const rolledOver = snapshot.status === 'rolled_over';

  const buy = async () => {
    if (!canPerformWrites) { Alert.alert('Brak internetu', 'Zakup ticketu wymaga połączenia.'); return; }
    setLoading(true);
    try { setSnapshot(await buyDailyJackpotTicket(snapshot.poolId!)); await refreshProfile(); }
    catch (cause) { Alert.alert('Jackpot', cause instanceof Error ? cause.message : 'Nie udało się kupić ticketu.'); }
    finally { setLoading(false); }
  };

  return <ImageBackground
    source={require('../../../../assets/images/jackpot/jackpot-bg.webp')}
    imageStyle={{ borderRadius: 14, opacity: 0.48 }}
    style={{ marginHorizontal: 12, minHeight: 194, overflow: 'hidden', borderRadius: 14, borderWidth: 1, borderColor: '#D6692F', backgroundColor: '#5A1C16', padding: 14, justifyContent: 'space-between' }}
  >
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <View style={{ gap: 1 }}><Text style={{ color: '#FAD0C0', fontSize: 9, fontWeight: '800' }}>PULA</Text><Text style={{ color: '#FFFFFF', fontSize: 31, lineHeight: 36, fontWeight: '900' }}>{formatJackpotAmount(snapshot.prizeAmount)}</Text></View>
      <View style={{ borderRadius: 999, backgroundColor: '#160B0BCC', paddingHorizontal: 10, paddingVertical: 6 }}><Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>{rolledOver ? '◷ Pula przechodzi dalej' : '◷ Jackpot Dnia'}</Text></View>
    </View>

    <View style={{ flexDirection: 'row', borderRadius: 10, overflow: 'hidden', backgroundColor: '#160B0BCC' }}>
      <JackpotStat label="CENA" value={formatJackpotAmount(snapshot.ticketPrice)} />
      <JackpotStat label="TWOJE TICKETY" value={snapshot.currentUserTicketNumbers.length ? snapshot.currentUserTicketNumbers.map(number => `#${String(number).padStart(2, '0')}`).join(' ') : '—'} bordered />
      <JackpotStat label="LIMIT" value={`Maks. ${snapshot.maxTicketsPerPlayer}`} />
    </View>

    <Pressable
      disabled={loading || (!canDraw && (limit || insufficientBalance))}
      onPress={() => canDraw ? router.push(`/jackpot/draw/${snapshot.poolId}`) : void buy()}
      style={{ borderRadius: 10, opacity: loading ? 0.72 : 1 }}
    >
      <View style={{ minHeight: 43, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFE14A' }}><Text style={{ color: '#21120B', fontSize: 13, fontWeight: '900' }}>{canDraw ? 'Zobacz rozliczenie  →' : limit ? 'Limit ticketów wykorzystany' : loading ? 'Kupowanie…' : `Kup ticket · ${formatJackpotAmount(snapshot.ticketPrice)}`}</Text></View>
    </Pressable>
  </ImageBackground>;
}

function JackpotStat({ label, value, bordered = false }: { label: string; value: string; bordered?: boolean }) {
  return <View style={{ flex: 1, minHeight: 49, alignItems: 'center', justifyContent: 'center', borderLeftWidth: bordered ? 1 : 0, borderRightWidth: bordered ? 1 : 0, borderColor: '#FFFFFF22' }}><Text style={{ color: '#EBC9BE', fontSize: 7, fontWeight: '800' }}>{label}</Text><Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '900' }}>{value}</Text></View>;
}
