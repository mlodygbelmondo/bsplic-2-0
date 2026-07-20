import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, Text, View } from 'react-native';

import { AppButton, AppCard, AppInput } from '@/components/ui';
import { getRouletteBetTypeLabel, getRouletteBetValueOptions, getRouletteColor, getRoulettePayoutMultiplier, getRoulettePhaseLabel } from '@/features/casino/lib/roulette';
import { useRouletteTable } from '@/features/casino/hooks/useRouletteTable';
import { useCasinoFeedback } from '@/features/casino/hooks/use-casino-feedback';
import { useAuth } from '@/providers/auth-provider';
import { useNetwork } from '@/providers/network-provider';
import type { RouletteBetType } from '@/types/database';

const c = { bg: '#09090b', card: 'rgba(17,15,22,0.94)', inset: '#1d1923', border: '#3d3448', text: '#fff', muted: '#b8adbE', gold: '#ffe14a', red: '#d71d3b', green: '#168f52' };
const types: RouletteBetType[] = ['straight', 'color', 'parity', 'range'];

export function RouletteScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const { canPerformWrites } = useNetwork();
  const feedback = useCasinoFeedback();
  const lastResultRef = useRef<string | null>(null);
  const table = useRouletteTable({ userId: user!.id, username: profile?.username, avatarUrl: profile?.avatar_url, refreshProfile });
  const [betType, setBetType] = useState<RouletteBetType>('color');
  const [betValue, setBetValue] = useState('red');
  const [stake, setStake] = useState('10');
  const values = useMemo(() => getRouletteBetValueOptions(betType), [betType]);
  useEffect(() => {
    const result = table.latestSettledRound;
    if (!result || result.id === lastResultRef.current) return;
    if (lastResultRef.current) feedback.result(table.activeBets.some(bet => bet.round_id === result.id && bet.is_win === true));
    lastResultRef.current = result.id;
  }, [feedback, table.activeBets, table.latestSettledRound]);
  const place = async () => {
    const amount = Number(stake.replace(',', '.'));
    if (!canPerformWrites) { Alert.alert('Brak internetu', 'Zakłady kasynowe nie są kolejkowane offline.'); return; }
    if (table.phase !== 'waiting') { Alert.alert('Zakłady zamknięte', 'Poczekaj na następną rundę.'); return; }
    if (!Number.isFinite(amount) || amount <= 0 || amount > Number(profile?.balance ?? 0)) { Alert.alert('Nieprawidłowa stawka', 'Sprawdź stawkę i saldo.'); return; }
    try { feedback.chip(); await table.placeBet({ betType, betValue, stake: amount }); }
    catch (cause) { Alert.alert('Nie przyjęto zakładu', cause instanceof Error ? cause.message : 'Spróbuj ponownie.'); }
  };
  return <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 12, padding: 12, paddingBottom: 116 }}>
    <View style={{ alignItems: 'center', gap: 5, paddingVertical: 8 }}><Text style={{ color: c.gold, fontSize: 11, fontWeight: '900', letterSpacing: 2 }}>KASYNO NA ŻYWO</Text><Text style={{ color: c.text, fontSize: 28, fontWeight: '900' }}>Ruletka</Text><Text style={{ color: c.muted }}>{table.currentRound ? `Runda #${table.currentRound.round_number}` : 'Stół główny'} · {getRoulettePhaseLabel(table.phase)}</Text><Text style={{ color: c.gold, fontSize: 32, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{table.countdownLabel}</Text></View>
    <AppCard style={{ backgroundColor: c.card, borderColor: c.border, alignItems: 'center', gap: 14 }}>
      <View style={{ width: 210, height: 210, borderRadius: 105, borderWidth: 16, borderColor: '#a77719', alignItems: 'center', justifyContent: 'center', backgroundColor: '#25130b' }}><View style={{ width: 152, height: 152, borderRadius: 76, borderWidth: 10, borderColor: table.phase === 'spinning' ? c.gold : '#5f441a', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' }}><Text style={{ color: table.latestSettledRound?.winning_color === 'red' ? '#ff4966' : table.latestSettledRound?.winning_color === 'green' ? '#42d98b' : '#fff', fontSize: 48, fontWeight: '900' }}>{table.phase === 'spinning' ? '●' : table.latestSettledRound?.winning_number ?? '?'}</Text><Text style={{ color: c.muted, fontSize: 10 }}>{table.phase === 'spinning' ? 'LOSOWANIE' : 'OSTATNI WYNIK'}</Text></View></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>{table.recentSpins.slice(0, 12).map(round => <View key={round.id} style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: round.winning_color === 'red' ? c.red : round.winning_color === 'green' ? c.green : '#151318', borderWidth: 1, borderColor: '#ffffff33' }}><Text style={{ color: '#fff', fontWeight: '900' }}>{round.winning_number}</Text></View>)}</ScrollView>
      {table.latestSettledRound && <AppButton variant="ghost" onPress={() => void Share.share({ message: `Ruletka BSPLIC: w rundzie #${table.latestSettledRound?.round_number} wypadło ${table.latestSettledRound?.winning_number}. https://bsplic.vercel.app/casino/roulette` })}>Udostępnij wynik</AppButton>}
    </AppCard>
    {table.tableMessage && <Text style={{ color: '#ff6b7f', textAlign: 'center' }}>{table.tableMessage}</Text>}
    <AppCard style={{ backgroundColor: c.card, borderColor: c.border, gap: 12 }}>
      <Text style={{ color: c.text, fontSize: 18, fontWeight: '900' }}>Postaw zakład</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>{types.map(type => <Pressable key={type} onPress={() => { setBetType(type); setBetValue(getRouletteBetValueOptions(type)[0].value); }} style={{ minHeight: 40, justifyContent: 'center', borderRadius: 999, backgroundColor: betType === type ? c.gold : c.inset, paddingHorizontal: 14 }}><Text style={{ color: betType === type ? '#17120a' : c.muted, fontWeight: '800' }}>{getRouletteBetTypeLabel(type)}</Text></Pressable>)}</ScrollView>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{values.map(option => { const number = Number(option.value); const bg = betType === 'straight' ? (getRouletteColor(number) === 'red' ? c.red : getRouletteColor(number) === 'green' ? c.green : '#151318') : c.inset; return <Pressable key={option.value} onPress={() => setBetValue(option.value)} style={{ minWidth: betType === 'straight' ? 45 : 100, minHeight: 42, flexGrow: betType === 'straight' ? 0 : 1, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: bg, borderWidth: betValue === option.value ? 3 : 1, borderColor: betValue === option.value ? c.gold : '#ffffff22' }}><Text style={{ color: '#fff', fontWeight: '900' }}>{option.label}</Text></Pressable>; })}</View>
      <AppInput label="Stawka" keyboardType="decimal-pad" value={stake} onChangeText={setStake} helperText={`Potencjalna wypłata: ${(Number(stake.replace(',', '.')) * getRoulettePayoutMultiplier(betType) || 0).toFixed(2)} zł`} />
      <AppButton loading={table.isPlacingBet} disabled={table.phase !== 'waiting' || !canPerformWrites} onPress={() => void place()}>Postaw zakład</AppButton>
    </AppCard>
    <AppCard style={{ backgroundColor: c.card, borderColor: c.border, gap: 10 }}><Text style={{ color: c.text, fontSize: 18, fontWeight: '900' }}>Twoje zakłady w rundzie</Text>{table.activeBets.length === 0 ? <Text style={{ color: c.muted }}>Nie masz jeszcze zakładów.</Text> : table.activeBets.map(bet => <View key={bet.id} style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: c.inset, borderRadius: 10, padding: 10 }}><Text style={{ color: c.text }}>{getRouletteBetTypeLabel(bet.bet_type)}: {bet.bet_value}</Text><Text style={{ color: c.gold, fontWeight: '900' }}>{bet.stake.toFixed(2)} zł</Text></View>)}</AppCard>
    <AppCard style={{ backgroundColor: c.card, borderColor: c.border, gap: 10 }}><Text style={{ color: c.text, fontSize: 18, fontWeight: '900' }}>Gracze ({table.roundParticipants.length})</Text>{table.roundParticipants.map(player => <View key={player.user_id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: c.text }}>{player.username} · {player.bet_count}</Text><Text style={{ color: c.muted }}>{player.total_stake.toFixed(2)} zł</Text></View>)}</AppCard>
  </ScrollView>;
}
