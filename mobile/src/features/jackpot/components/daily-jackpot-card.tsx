import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Alert, AppState, Pressable, Text, View } from 'react-native';

import { buyDailyJackpotTicket, getDailyJackpotState } from '@/features/jackpot/api/jackpot';
import { formatJackpotAmount, getDrawTimeLabel } from '@/features/jackpot/lib/jackpotFormat';
import { useAuth } from '@/providers/auth-provider';
import { useNetwork } from '@/providers/network-provider';
import type { DailyJackpotSnapshot } from '@/features/jackpot/types';

export function DailyJackpotCard({ enabled = true }: { enabled?: boolean }) {
  const { profile, refreshProfile } = useAuth(); const { canPerformWrites } = useNetwork();
  const [snapshot, setSnapshot] = useState<DailyJackpotSnapshot | null>(null); const [loading, setLoading] = useState(false);
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
  const buy = async () => { if (!canPerformWrites) { Alert.alert('Brak internetu', 'Zakup ticketu wymaga połączenia.'); return; } setLoading(true); try { setSnapshot(await buyDailyJackpotTicket(snapshot.poolId!)); await refreshProfile(); } catch (cause) { Alert.alert('Jackpot', cause instanceof Error ? cause.message : 'Nie udało się kupić ticketu.'); } finally { setLoading(false); } };
  return <View style={{ marginHorizontal: 12, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#f1b72e88', backgroundColor: '#200d2d', padding: 17, gap: 9 }}><Text style={{ color: '#f7c846', fontWeight: '900', letterSpacing: 2, fontSize: 11 }}>DAILY JACKPOT</Text><Text style={{ color: '#fff', fontSize: 29, fontWeight: '900' }}>{formatJackpotAmount(snapshot.prizeAmount)}</Text><Text style={{ color: '#d2c1dc', fontSize: 12 }}>{getDrawTimeLabel(snapshot.drawScheduledAt, snapshot.serverNow)} · {snapshot.participantCount}/{snapshot.minUniqueUsers} graczy</Text>{snapshot.currentUserTicketNumbers.length > 0 && <Text style={{ color: '#ffe14a', fontWeight: '800' }}>Twoje tickety: {snapshot.currentUserTicketNumbers.map(number => `#${String(number).padStart(2, '0')}`).join(' ')}</Text>}<Pressable disabled={loading || (!canDraw && (limit || Number(profile?.balance ?? 0) < snapshot.ticketPrice))} onPress={() => canDraw ? router.push(`/jackpot/draw/${snapshot.poolId}`) : void buy()} style={{ minHeight: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5c33c', opacity: loading ? 0.6 : 1 }}><Text style={{ color: '#21120b', fontWeight: '900' }}>{canDraw ? 'Zobacz losowanie' : limit ? 'Limit ticketów wykorzystany' : loading ? 'Kupowanie…' : `Kup ticket · ${formatJackpotAmount(snapshot.ticketPrice)}`}</Text></Pressable></View>;
}
