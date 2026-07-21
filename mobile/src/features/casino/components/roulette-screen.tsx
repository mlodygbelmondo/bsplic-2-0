/* eslint-disable @typescript-eslint/no-require-imports -- Metro requires static bundled asset paths. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ImageBackground, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { ChevronDown, ChevronUp, History, Users } from 'lucide-react-native';

import { AppButton, AppInput } from '@/components/ui';
import { RouletteWheel } from '@/features/casino/components/roulette-wheel';
import { useCasinoFeedback } from '@/features/casino/hooks/use-casino-feedback';
import { useRouletteTable } from '@/features/casino/hooks/useRouletteTable';
import { getRouletteBetTypeLabel, getRouletteBetValueOptions, getRouletteColor, getRoulettePayoutMultiplier, getRoulettePhaseLabel } from '@/features/casino/lib/roulette';
import { createCasinoShare } from '@/features/social/api/social';
import { useRouteActive } from '@/hooks/use-route-active';
import { useAuth } from '@/providers/auth-provider';
import { useNetwork } from '@/providers/network-provider';
import type { RouletteBetType } from '@/types/database';

const c = { bg: '#09090b', card: 'rgba(14,12,17,0.84)', inset: 'rgba(29,25,35,0.92)', border: '#4a3d2c', text: '#fff', muted: '#b8adbe', gold: '#ffe14a', red: '#d71d3b', green: '#168f52' };
const types: RouletteBetType[] = ['straight', 'color', 'parity', 'range'];

export function RouletteScreen() {
  const routeActive = useRouteActive();
  const { user, profile, refreshProfile } = useAuth();
  const { canPerformWrites } = useNetwork();
  const feedback = useCasinoFeedback();
  const lastResultRef = useRef<string | null>(null);
  const table = useRouletteTable({ userId: user!.id, username: profile?.username, avatarUrl: profile?.avatar_url, refreshProfile, enabled: routeActive });
  const [betType, setBetType] = useState<RouletteBetType>('color');
  const [betValue, setBetValue] = useState('red');
  const [stake, setStake] = useState('10');
  const [betPanelOpen, setBetPanelOpen] = useState(false);
  const [sharingToSocial, setSharingToSocial] = useState(false);
  const values = useMemo(() => getRouletteBetValueOptions(betType), [betType]);
  const shareableWin = useMemo(() => table.recentWins.find((win) => win.user_id === user!.id) ?? null, [table.recentWins, user]);

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
    try { feedback.chip(); await table.placeBet({ betType, betValue, stake: amount }); setBetPanelOpen(false); }
    catch (cause) { Alert.alert('Nie przyjęto zakładu', cause instanceof Error ? cause.message : 'Spróbuj ponownie.'); }
  };

  const shareToSocial = async () => {
    if (!shareableWin || !canPerformWrites) { Alert.alert('Brak internetu', 'Publikowanie w Socialu wymaga połączenia.'); return; }
    const round = table.recentSpins.find((item) => item.round_number === shareableWin.round_number);
    setSharingToSocial(true);
    try {
      await createCasinoShare({ userId: user!.id, betId: shareableWin.id, content: `Moja wygrana w ruletce: ${shareableWin.payout.toFixed(2)} zł 🎯`, betType: shareableWin.bet_type, betValue: shareableWin.bet_value, stake: shareableWin.stake, payout: shareableWin.payout, roundNumber: shareableWin.round_number, winningNumber: round?.winning_number ?? null, winningColor: round?.winning_color ?? null });
      Alert.alert('Opublikowano', 'Wynik jest już widoczny w Socialu.');
    } catch (cause) { Alert.alert('Nie udało się opublikować', cause instanceof Error ? cause.message : 'Spróbuj ponownie.'); }
    finally { setSharingToSocial(false); }
  };

  const phaseLabel = table.phase === 'waiting' ? 'CZEKA NA ZAKŁAD' : getRoulettePhaseLabel(table.phase).toUpperCase();
  return (
    <ImageBackground source={require('../../../../assets/images/casino/roulette-mobile-background.webp')} resizeMode="cover" style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 174 }}>
        <View style={{ minHeight: 58, borderRadius: 15, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View><Text allowFontScaling={false} style={{ color: c.muted, fontSize: 10, fontWeight: '800', letterSpacing: 2 }}>{phaseLabel}</Text><Text allowFontScaling={false} style={{ color: c.muted, fontSize: 10, marginTop: 5 }}>{table.currentRound ? `Runda #${table.currentRound.round_number}` : 'Stół główny'}</Text></View>
          <Text allowFontScaling={false} style={{ color: c.text, fontSize: 25, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{table.countdownLabel || '—:—'}</Text>
        </View>

        <View style={{ alignItems: 'center', marginVertical: -2 }}><RouletteWheel phase={table.phase} winningNumber={table.latestSettledRound?.winning_number ?? null} /></View>

        <View style={{ borderRadius: 15, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Users size={16} color={c.gold} /><Text allowFontScaling={false} style={{ color: c.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>GRACZE W RUNDZIE</Text><View style={{ marginLeft: 'auto', minWidth: 27, height: 27, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: c.inset }}><Text allowFontScaling={false} style={{ color: c.muted, fontSize: 11 }}>{table.roundParticipants.length}</Text></View></View>
          {table.roundParticipants.length === 0 ? <Text allowFontScaling={false} style={{ color: c.muted, fontSize: 13 }}>Pierwszy zakład otworzy listę graczy tej rundy.</Text> : table.roundParticipants.map(player => <View key={player.user_id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text allowFontScaling={false} style={{ color: c.text, fontSize: 13 }}>{player.username} · {player.bet_count}</Text><Text allowFontScaling={false} style={{ color: c.muted, fontSize: 13 }}>{player.total_stake.toFixed(2)} zł</Text></View>)}
        </View>

        <View style={{ borderRadius: 15, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><History size={16} color={c.gold} /><Text allowFontScaling={false} style={{ color: c.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>OSTATNIE SPINY</Text></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 9 }}>{table.recentSpins.slice(0, 12).map(round => <View key={round.id} style={{ width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: round.winning_color === 'red' ? `${c.red}35` : round.winning_color === 'green' ? `${c.green}55` : '#151318', borderWidth: 1, borderColor: round.winning_color === 'red' ? '#e55067' : '#ffffff25' }}><Text allowFontScaling={false} style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>{round.winning_number}</Text></View>)}</ScrollView>
          {table.latestSettledRound ? <Pressable onPress={() => void Share.share({ message: `Ruletka BSPLIC: w rundzie #${table.latestSettledRound?.round_number} wypadło ${table.latestSettledRound?.winning_number}. https://bsplic.vercel.app/casino/roulette` })} style={{ minHeight: 34, justifyContent: 'center' }}><Text allowFontScaling={false} style={{ color: c.muted, fontSize: 12, textAlign: 'center' }}>Udostępnij wynik</Text></Pressable> : null}
        </View>

        {table.activeBets.length > 0 ? <View style={{ borderRadius: 15, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14, gap: 8 }}><Text allowFontScaling={false} style={{ color: c.text, fontSize: 15, fontWeight: '800' }}>Twoje zakłady w rundzie</Text>{table.activeBets.map(bet => <View key={bet.id} style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: c.inset, borderRadius: 10, padding: 10 }}><Text allowFontScaling={false} style={{ color: c.text, fontSize: 13 }}>{getRouletteBetTypeLabel(bet.bet_type)}: {bet.bet_value}</Text><Text allowFontScaling={false} style={{ color: c.gold, fontSize: 13, fontWeight: '800' }}>{bet.stake.toFixed(2)} zł</Text></View>)}</View> : null}
        {shareableWin ? <AppButton variant="secondary" loading={sharingToSocial} disabled={!canPerformWrites} onPress={() => void shareToSocial()}>Opublikuj wygraną w Socialu</AppButton> : null}
        {table.tableMessage ? <Text style={{ color: '#ff6b7f', textAlign: 'center' }}>{table.tableMessage}</Text> : null}
      </ScrollView>

      {betPanelOpen ? <View style={{ position: 'absolute', left: 10, right: 10, bottom: 86, maxHeight: 520, borderRadius: 22, borderWidth: 1, borderColor: c.border, backgroundColor: '#110e16f5', padding: 14, gap: 11 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Zamknij panel stawki" onPress={() => setBetPanelOpen(false)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}><ChevronDown size={17} color={c.muted} /><Text allowFontScaling={false} style={{ color: c.text, fontSize: 14, fontWeight: '800' }}>STAWKA</Text><Text allowFontScaling={false} style={{ color: c.gold, fontSize: 12, fontWeight: '800' }}>{stake || '0'} zł</Text></Pressable>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 11 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>{types.map(type => <Pressable key={type} onPress={() => { setBetType(type); setBetValue(getRouletteBetValueOptions(type)[0].value); }} style={{ minHeight: 38, justifyContent: 'center', borderRadius: 999, backgroundColor: betType === type ? c.gold : c.inset, paddingHorizontal: 14 }}><Text allowFontScaling={false} style={{ color: betType === type ? '#17120a' : c.muted, fontSize: 13, fontWeight: '800' }}>{getRouletteBetTypeLabel(type)}</Text></Pressable>)}</ScrollView>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{values.map(option => { const number = Number(option.value); const bg = betType === 'straight' ? (getRouletteColor(number) === 'red' ? c.red : getRouletteColor(number) === 'green' ? c.green : '#151318') : c.inset; return <Pressable key={option.value} onPress={() => setBetValue(option.value)} style={{ minWidth: betType === 'straight' ? 42 : 100, minHeight: 40, flexGrow: betType === 'straight' ? 0 : 1, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: bg, borderWidth: betValue === option.value ? 2 : 1, borderColor: betValue === option.value ? c.gold : '#ffffff22' }}><Text allowFontScaling={false} style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>{option.label}</Text></Pressable>; })}</View>
          <AppInput label="Stawka" keyboardType="decimal-pad" value={stake} onChangeText={setStake} helperText={`Potencjalna wypłata: ${(Number(stake.replace(',', '.')) * getRoulettePayoutMultiplier(betType) || 0).toFixed(2)} zł`} />
          <AppButton loading={table.isPlacingBet} disabled={table.phase !== 'waiting' || !canPerformWrites} onPress={() => void place()}>Postaw zakład</AppButton>
        </ScrollView>
      </View> : <Pressable accessibilityRole="button" accessibilityLabel="Otwórz panel stawki" onPress={() => setBetPanelOpen(true)} style={{ position: 'absolute', left: 10, right: 10, bottom: 86, minHeight: 48, borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: '#110e16f2', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}><ChevronUp size={17} color={c.muted} /><Text allowFontScaling={false} style={{ color: c.text, fontSize: 13, fontWeight: '800', letterSpacing: 1 }}>STAWKA</Text><View style={{ borderRadius: 999, backgroundColor: '#3b2e18', paddingHorizontal: 9, paddingVertical: 4 }}><Text allowFontScaling={false} style={{ color: c.gold, fontSize: 11, fontWeight: '800' }}>{stake || '0'} zł</Text></View></Pressable>}
    </ImageBackground>
  );
}
