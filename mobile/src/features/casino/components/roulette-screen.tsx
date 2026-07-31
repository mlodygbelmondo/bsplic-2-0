/* eslint-disable @typescript-eslint/no-require-imports -- Metro requires static bundled asset paths. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, ImageBackground, Pressable, ScrollView, Text, View } from 'react-native';
import { ChevronUp, Trophy, Users, Volume2, VolumeX } from 'lucide-react-native';

import { AppButton, AppInput } from '@/components/ui';
import { useChromeScroll } from '@/components/navigation/navigation-chrome';
import { RouletteWheel } from '@/features/casino/components/roulette-wheel';
import { useCasinoFeedback } from '@/features/casino/hooks/use-casino-feedback';
import { useRouletteTable } from '@/features/casino/hooks/useRouletteTable';
import {
  formatRouletteBetValue,
  getRouletteBetTypeLabel,
  getRouletteBetValueOptions,
  getRouletteColor,
  getRoulettePayoutMultiplier,
} from '@/features/casino/lib/roulette';
import { createCasinoShare } from '@/features/social/api/social';
import { useRouteActive } from '@/hooks/use-route-active';
import { useAuth } from '@/providers/auth-provider';
import { useNetwork } from '@/providers/network-provider';
import type { RouletteBetType } from '@/types/database';

const colors = {
  card: 'rgba(14,12,17,0.74)',
  inset: 'rgba(255,255,255,0.045)',
  border: 'rgba(255,255,255,0.10)',
  text: '#ffffff',
  muted: 'rgba(255,255,255,0.42)',
  gold: '#f5b942',
  red: '#d71d3b',
  green: '#168f52',
};
const types: RouletteBetType[] = ['straight', 'color', 'parity', 'range'];

export interface RouletteScreenProps {
  active?: boolean;
  topInset?: number;
  onSwipeBlockedChange?: (blocked: boolean) => void;
}

export function RouletteScreen({
  active,
  topInset = 0,
  onSwipeBlockedChange,
}: RouletteScreenProps = {}) {
  const focused = useRouteActive();
  const routeActive = active ?? focused;
  const { user, profile, refreshProfile } = useAuth();
  const { canPerformWrites } = useNetwork();
  const feedback = useCasinoFeedback();
  const lastResultRef = useRef<string | null>(null);
  const table = useRouletteTable({ userId: user!.id, username: profile?.username, avatarUrl: profile?.avatar_url, refreshProfile, enabled: routeActive });
  const [betType, setBetType] = useState<RouletteBetType>('straight');
  const [betValue, setBetValue] = useState('');
  const [stake, setStake] = useState('10');
  const [betPanelOpen, setBetPanelOpen] = useState(false);
  const [sharingToSocial, setSharingToSocial] = useState(false);
  const chromeScroll = useChromeScroll({ active: routeActive, minimumHideOffset: topInset });
  const values = useMemo(() => getRouletteBetValueOptions(betType), [betType]);
  const shareableWin = useMemo(() => table.recentWins.find((win) => win.user_id === user!.id) ?? null, [table.recentWins, user]);

  useEffect(() => {
    if (!routeActive) return;
    const result = table.latestSettledRound;
    if (!result || result.id === lastResultRef.current) return;
    if (lastResultRef.current) feedback.result(table.activeBets.some((bet) => bet.round_id === result.id && bet.is_win === true));
    lastResultRef.current = result.id;
  }, [feedback, routeActive, table.activeBets, table.latestSettledRound]);

  useEffect(() => {
    onSwipeBlockedChange?.(betPanelOpen || table.isPlacingBet || sharingToSocial);
  }, [betPanelOpen, onSwipeBlockedChange, sharingToSocial, table.isPlacingBet]);
  useEffect(() => {
    if (routeActive) return;
    setBetPanelOpen(false);
  }, [routeActive]);

  const place = async () => {
    const amount = Number(stake.replace(',', '.'));
    if (!canPerformWrites) {
      Alert.alert('Brak internetu', 'Zakłady kasynowe nie są kolejkowane offline.');
      return;
    }
    if (!betValue) {
      Alert.alert('Wybierz zakład', 'Najpierw wybierz numer lub wartość zakładu.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > Number(profile?.balance ?? 0)) {
      Alert.alert('Nieprawidłowa stawka', 'Sprawdź stawkę i saldo.');
      return;
    }
    try {
      feedback.chip();
      await table.placeBet({ betType, betValue, stake: amount });
      setBetPanelOpen(false);
    } catch (cause) {
      Alert.alert('Nie przyjęto zakładu', cause instanceof Error ? cause.message : 'Spróbuj ponownie.');
    }
  };

  const shareToSocial = async () => {
    if (!shareableWin || !canPerformWrites) {
      Alert.alert('Brak internetu', 'Publikowanie w Socialu wymaga połączenia.');
      return;
    }
    const round = table.recentSpins.find((item) => item.round_number === shareableWin.round_number);
    setSharingToSocial(true);
    try {
      await createCasinoShare({ userId: user!.id, betId: shareableWin.id, content: `Moja wygrana w ruletce: ${shareableWin.payout.toFixed(2)} zł 🎯`, betType: shareableWin.bet_type, betValue: shareableWin.bet_value, stake: shareableWin.stake, payout: shareableWin.payout, roundNumber: shareableWin.round_number, winningNumber: round?.winning_number ?? null, winningColor: round?.winning_color ?? null });
      Alert.alert('Opublikowano', 'Wynik jest już widoczny w Socialu.');
    } catch (cause) {
      Alert.alert('Nie udało się opublikować', cause instanceof Error ? cause.message : 'Spróbuj ponownie.');
    } finally {
      setSharingToSocial(false);
    }
  };

  const countdownLabel = table.isIdle ? 'CZEKA NA ZAKŁAD' : table.phase === 'spinning' ? 'WYNIK ZA' : 'SPIN ZA';
  const roundLabel = table.currentRound ? `#${table.currentRound.round_number}` : '#--';
  const countdownText = table.isIdle ? '--:--' : table.countdownLabel;

  return (
    <ImageBackground source={require('../../../../assets/images/casino/roulette-mobile-background.webp')} resizeMode="cover" style={{ flex: 1, backgroundColor: '#09090b' }}>
      <View pointerEvents="none" style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(5,4,7,0.34)' }} />
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ gap: 20, paddingHorizontal: 16, paddingTop: topInset + 12, paddingBottom: 174 }}
        onScroll={chromeScroll.onScroll}
        onScrollBeginDrag={chromeScroll.onScrollBeginDrag}
        scrollEventThrottle={chromeScroll.scrollEventThrottle}
      >
        <View style={{ minHeight: 58, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(0,0,0,0.46)', paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text allowFontScaling={false} style={{ color: 'rgba(253,230,138,0.72)', fontSize: 10, fontWeight: '700', letterSpacing: 2 }}>{countdownLabel}</Text>
            <Text allowFontScaling={false} style={{ color: colors.muted, fontSize: 10, marginTop: 5, fontVariant: ['tabular-nums'] }}>{roundLabel}</Text>
          </View>
          <Text allowFontScaling={false} style={{ color: colors.text, fontSize: 19, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{countdownText}</Text>
        </View>

        <View style={{ position: 'relative', alignItems: 'center', marginTop: -4, marginBottom: -4 }}>
          <RouletteWheel phase={table.phase} winningNumber={table.currentRound?.winning_number ?? table.latestSettledRound?.winning_number ?? null} />
          <Pressable accessibilityRole="button" accessibilityLabel={feedback.muted ? 'Włącz dźwięki' : 'Wycisz dźwięki'} onPress={feedback.toggleMuted} style={{ position: 'absolute', right: 0, top: 10, width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(0,0,0,0.46)' }}>
            {feedback.muted ? <VolumeX size={17} color="rgba(255,255,255,0.62)" /> : <Volume2 size={17} color="rgba(255,255,255,0.62)" />}
          </Pressable>
        </View>

        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 16, gap: 11 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Users size={16} color={colors.gold} />
            <Text allowFontScaling={false} style={{ color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.1 }}>GRACZE W RUNDZIE</Text>
            <View style={{ marginLeft: 'auto', minWidth: 27, height: 27, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.inset }}><Text allowFontScaling={false} style={{ color: colors.muted, fontSize: 11 }}>{table.roundParticipants.length}</Text></View>
          </View>
          {table.roundParticipants.length === 0 ? (
            <Text allowFontScaling={false} style={{ color: colors.muted, fontSize: 13 }}>Pierwszy zakład otworzy listę graczy tej rundy.</Text>
          ) : table.roundParticipants.map((player) => (
            <View key={player.user_id} style={{ gap: 7, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 9 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text allowFontScaling={false} style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>{player.username} · {player.bet_count}</Text><Text allowFontScaling={false} style={{ color: '#fde7a5', fontSize: 13, fontWeight: '700' }}>{player.total_stake.toFixed(2)} zł</Text></View>
              {player.bets.map((bet, index) => <Text key={`${bet.bet_type}-${bet.bet_value}-${index}`} allowFontScaling={false} style={{ color: colors.muted, fontSize: 10 }}>{getRouletteBetTypeLabel(bet.bet_type)}: {formatRouletteBetValue(bet.bet_type, bet.bet_value)} · {bet.stake.toFixed(2)} zł</Text>)}
            </View>
          ))}
        </View>

        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 16, gap: 11 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Trophy size={16} color={colors.gold} /><Text allowFontScaling={false} style={{ color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.1 }}>OSTATNIE WYGRANE</Text></View>
          {table.recentWins.length === 0 ? <Text allowFontScaling={false} style={{ color: colors.muted, fontSize: 13 }}>Brak ostatnich wygranych</Text> : table.recentWins.slice(0, 10).map((win) => (
            <View key={win.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', backgroundColor: colors.inset, padding: 10 }}>
              {win.avatar_url ? <Image source={{ uri: win.avatar_url }} style={{ width: 32, height: 32, borderRadius: 16 }} /> : <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(245,185,66,0.12)' }}><Text allowFontScaling={false} style={{ color: '#fde7a5', fontSize: 10, fontWeight: '800' }}>{win.username.slice(0, 2).toUpperCase()}</Text></View>}
              <View style={{ flex: 1 }}><Text allowFontScaling={false} style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>{win.username}</Text><Text allowFontScaling={false} style={{ color: colors.muted, fontSize: 10 }}>{getRouletteBetTypeLabel(win.bet_type)} • {formatRouletteBetValue(win.bet_type, win.bet_value)} • #{win.round_number}</Text></View>
              <Text allowFontScaling={false} style={{ color: '#4ade80', fontSize: 13, fontWeight: '800' }}>+{win.payout.toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {table.activeBets.filter((bet) => bet.is_win === null).length > 0 ? (
          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 14, gap: 8 }}>
            <Text allowFontScaling={false} style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>Twoje zakłady w rundzie</Text>
            {table.activeBets.filter((bet) => bet.is_win === null).map((bet) => <View key={bet.id} style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.inset, borderRadius: 10, padding: 10 }}><Text allowFontScaling={false} style={{ color: colors.text, fontSize: 13 }}>{getRouletteBetTypeLabel(bet.bet_type)}: {formatRouletteBetValue(bet.bet_type, bet.bet_value)}</Text><Text allowFontScaling={false} style={{ color: colors.gold, fontSize: 13, fontWeight: '800' }}>{bet.stake.toFixed(2)} zł</Text></View>)}
          </View>
        ) : null}
        {shareableWin ? <AppButton variant="secondary" loading={sharingToSocial} disabled={!canPerformWrites} onPress={() => void shareToSocial()}>Opublikuj wygraną w Socialu</AppButton> : null}
        {table.tableMessage ? <Text style={{ color: '#ff6b7f', textAlign: 'center' }}>{table.tableMessage}</Text> : null}
      </ScrollView>

      {betPanelOpen ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 84, maxHeight: 590, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(0,0,0,0.97)', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 18 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Zamknij panel stawki" onPress={() => setBetPanelOpen(false)} style={{ minHeight: 32, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 48, height: 5, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.20)' }} /></Pressable>
          <ScrollView showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 13, paddingBottom: 12 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>{types.map((type) => <Pressable key={type} onPress={() => { setBetType(type); setBetValue(''); }} style={{ minHeight: 38, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: betType === type ? 'rgba(245,185,66,0.58)' : colors.border, backgroundColor: betType === type ? 'rgba(245,185,66,0.15)' : colors.inset, paddingHorizontal: 14 }}><Text allowFontScaling={false} style={{ color: betType === type ? '#fde7a5' : 'rgba(255,255,255,0.62)', fontSize: 13, fontWeight: '800' }}>{getRouletteBetTypeLabel(type)}</Text></Pressable>)}</ScrollView>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{values.map((option) => { const number = Number(option.value); const backgroundColor = betType === 'straight' ? (getRouletteColor(number) === 'red' ? colors.red : getRouletteColor(number) === 'green' ? colors.green : '#151318') : colors.inset; return <Pressable key={option.value} onPress={() => setBetValue(option.value)} style={{ minWidth: betType === 'straight' ? 42 : 100, minHeight: 40, flexGrow: betType === 'straight' ? 0 : 1, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor, borderWidth: betValue === option.value ? 2 : 1, borderColor: betValue === option.value ? colors.gold : colors.border }}><Text allowFontScaling={false} style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>{option.label}</Text></Pressable>; })}</View>
            <View style={{ flexDirection: 'row', gap: 7 }}>{[10, 25, 50, 100].map((value) => <Pressable key={value} onPress={() => setStake(String(value))} style={{ flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 9, borderWidth: 1, borderColor: Number(stake) === value ? 'rgba(245,185,66,0.55)' : colors.border, backgroundColor: Number(stake) === value ? 'rgba(245,185,66,0.14)' : colors.inset }}><Text allowFontScaling={false} style={{ color: Number(stake) === value ? '#fde7a5' : colors.muted, fontSize: 13, fontWeight: '700' }}>{value}</Text></Pressable>)}</View>
            <AppInput label="Stawka" keyboardType="decimal-pad" value={stake} onChangeText={setStake} helperText={betValue ? `Możliwa wygrana: ${(Number(stake.replace(',', '.')) * getRoulettePayoutMultiplier(betType) || 0).toFixed(2)} zł` : 'Wybierz wartość zakładu'} />
          </ScrollView>
          <View style={{ gap: 7, paddingTop: 10 }}>
            <AppButton loading={table.isPlacingBet} disabled={!canPerformWrites || !betValue} onPress={() => void place()}>Postaw zakład</AppButton>
            <Text allowFontScaling={false} style={{ color: colors.muted, fontSize: 10, textAlign: 'center' }}>Saldo: {Number(profile?.balance ?? 0).toFixed(2)} zł</Text>
          </View>
        </View>
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel="Otwórz kupon ruletki" onPress={() => setBetPanelOpen(true)} style={{ position: 'absolute', left: 0, right: 0, bottom: 84, minHeight: 58, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(0,0,0,0.92)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <ChevronUp size={18} color="rgba(255,255,255,0.6)" />
          <Text allowFontScaling={false} style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '700', letterSpacing: 1 }}>STAWKA</Text>
          <View style={{ borderRadius: 7, backgroundColor: 'rgba(245,185,66,0.14)', paddingHorizontal: 8, paddingVertical: 4 }}><Text allowFontScaling={false} style={{ color: '#fde7a5', fontSize: 11, fontWeight: '800' }}>{(Number(stake) || 0).toFixed(2)} zł</Text></View>
        </Pressable>
      )}
    </ImageBackground>
  );
}
