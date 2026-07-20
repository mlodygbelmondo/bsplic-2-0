import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { placeCouponSecure } from '@/features/home/api/coupons';
import { useAuth } from '@/providers/auth-provider';
import { useCoupon } from '@/providers/coupon-provider';
import { useNetwork } from '@/providers/network-provider';
import { fetchAkoExclusionsForBets, findAkoConflict, formatAkoConflict, type AkoExclusion } from '@/features/coupons/ako-exclusions';

type CouponMode = 'single' | 'ako';

const colors = {
  background: '#090005',
  card: '#1a050d',
  border: '#5b1a2e',
  foreground: '#fff2f5',
  muted: '#d9a8b6',
  primary: '#ff0a54',
  yellow: '#ffe14a',
};

function parseStake(value: string) {
  const normalized = value.replace(',', '.');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.round(parsed * 100) / 100;
}

function hasValidPrecision(value: string) {
  const normalized = value.replace(',', '.');
  return /^\d+(?:[.,]\d{1,2})?$/.test(value) && parseStake(normalized) > 0;
}

export function CouponScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const { items, totalOdds, clearCoupon, removeItem } = useCoupon();
  const { canPerformWrites } = useNetwork();
  const [akoExclusions, setAkoExclusions] = useState<AkoExclusion[]>([]);
  const [mode, setMode] = useState<CouponMode>(items.length > 1 ? 'ako' : 'single');
  const [akoStake, setAkoStake] = useState('');
  const [singleStakes, setSingleStakes] = useState<Record<string, string>>({});
  const [placing, setPlacing] = useState(false);
  useEffect(() => { void fetchAkoExclusionsForBets(items.map(item => item.bet.id)).then(setAkoExclusions).catch(() => setAkoExclusions([])); }, [items]);
  const akoConflict = useMemo(() => findAkoConflict(items.map(item => ({ betId: item.bet.id, title: item.bet.title })), akoExclusions), [akoExclusions, items]);

  const totalStake = useMemo(() => {
    if (mode === 'ako') return parseStake(akoStake);
    return items.reduce(
      (total, item) => total + parseStake(singleStakes[item.bet.id] ?? ''),
      0,
    );
  }, [akoStake, items, mode, singleStakes]);

  const potentialWin = useMemo(() => {
    if (mode === 'ako') return totalStake * totalOdds;
    return items.reduce(
      (total, item) =>
        total + parseStake(singleStakes[item.bet.id] ?? '') * item.odds,
      0,
    );
  }, [items, mode, singleStakes, totalOdds, totalStake]);

  const place = async () => {
    if (!canPerformWrites) { Alert.alert('Brak internetu', 'Kupony nie są kolejkowane offline. Połącz się i spróbuj ponownie.'); return; }
    if (!user || !profile) {
      Alert.alert('Sesja wygasła', 'Zaloguj się ponownie.');
      return;
    }
    if (items.length === 0) {
      Alert.alert('Pusty kupon', 'Dodaj co najmniej jeden zakład.');
      return;
    }
    if (mode === 'ako' && akoConflict) { Alert.alert('Niedozwolone połączenie AKO', formatAkoConflict(akoConflict)); return; }

    const stakeInputs =
      mode === 'ako'
        ? [akoStake]
        : items.map((item) => singleStakes[item.bet.id] ?? '');
    if (stakeInputs.some((value) => !hasValidPrecision(value))) {
      Alert.alert('Nieprawidłowa stawka', 'Podaj dodatnią kwotę z maksymalnie dwoma miejscami po przecinku.');
      return;
    }
    if (totalStake > Number(profile.balance)) {
      Alert.alert('Brak środków', `Saldo: ${Number(profile.balance).toFixed(2)} zł`);
      return;
    }

    setPlacing(true);
    const placedSingleIds: string[] = [];
    try {
      if (mode === 'ako') {
        const cents = Math.round(totalStake * 100);
        const baseCents = Math.floor(cents / items.length);
        const remainder = cents % items.length;
        await placeCouponSecure({
          userId: user.id,
          totalOdds,
          stake: totalStake,
          items: items.map((item, index) => ({
            betId: item.bet.id,
            selectedOption: item.selectedOption,
            odds: item.odds,
            stake: (baseCents + (index < remainder ? 1 : 0)) / 100,
          })),
        });
      } else {
        for (const item of items) {
          const stake = parseStake(singleStakes[item.bet.id] ?? '');
          await placeCouponSecure({
            userId: user.id,
            totalOdds: 1,
            stake,
            items: [
              {
                betId: item.bet.id,
                selectedOption: item.selectedOption,
                odds: item.odds,
                stake,
              },
            ],
          });
          placedSingleIds.push(item.bet.id);
        }
      }

      clearCoupon();
      void refreshProfile().catch(() => undefined);
      Alert.alert('Gotowe', 'Kupon został postawiony.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      placedSingleIds.forEach(removeItem);
      void refreshProfile().catch(() => undefined);
      Alert.alert(
        'Nie udało się postawić kuponu',
        error instanceof Error ? error.message : 'Spróbuj ponownie.',
      );
    } finally {
      setPlacing(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 14, padding: 16, paddingBottom: 42 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['single', 'ako'] as CouponMode[]).map((candidate) => (
            <Pressable
              key={candidate}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === candidate }}
              disabled={candidate === 'ako' && items.length < 2}
              onPress={() => setMode(candidate)}
              style={{
                minHeight: 46,
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 12,
                backgroundColor: mode === candidate ? colors.primary : colors.card,
                opacity: candidate === 'ako' && items.length < 2 ? 0.4 : 1,
              }}>
              <Text style={{ color: colors.foreground, fontWeight: '900' }}>
                {candidate === 'single' ? 'Single' : 'AKO'}
              </Text>
            </Pressable>
          ))}
        </View>

        {items.length === 0 ? (
          <View style={{ alignItems: 'center', gap: 8, paddingVertical: 50 }}>
            <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: '900' }}>
              Kupon jest pusty
            </Text>
            <Pressable onPress={() => router.back()} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ color: colors.primary, fontWeight: '800' }}>Wróć do zakładów</Text>
            </Pressable>
          </View>
        ) : (
          items.map((item) => (
            <View
              key={item.bet.id}
              style={{
                gap: 8,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                padding: 14,
              }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text selectable style={{ color: colors.foreground, fontWeight: '800' }}>
                    {item.bet.title}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {item.selectedOption} · {item.odds.toFixed(2)}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Usuń ${item.bet.title}`}
                  onPress={() => removeItem(item.bet.id)}
                  style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: colors.primary, fontSize: 20 }}>×</Text>
                </Pressable>
              </View>

              {mode === 'single' ? (
                <TextInput
                  accessibilityLabel={`Stawka dla ${item.bet.title}`}
                  value={singleStakes[item.bet.id] ?? ''}
                  onChangeText={(value) =>
                    setSingleStakes((current) => ({ ...current, [item.bet.id]: value }))
                  }
                  placeholder="Stawka"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                  style={{
                    minHeight: 48,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    color: colors.foreground,
                    paddingHorizontal: 14,
                    fontVariant: ['tabular-nums'],
                  }}
                />
              ) : null}
            </View>
          ))
        )}

        {items.length > 0 && mode === 'ako' ? (
          <TextInput
            accessibilityLabel="Stawka kuponu AKO"
            value={akoStake}
            onChangeText={setAkoStake}
            placeholder="Stawka AKO"
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
            style={{
              minHeight: 52,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              color: colors.foreground,
              paddingHorizontal: 16,
              fontVariant: ['tabular-nums'],
            }}
          />
        ) : null}

        {mode === 'ako' && akoConflict && <View style={{ borderRadius: 12, backgroundColor: '#6d172b', padding: 12 }}><Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{formatAkoConflict(akoConflict)}</Text></View>}

        {items.length > 0 ? (
          <View style={{ gap: 8, borderRadius: 16, backgroundColor: '#250711', padding: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.muted }}>Łączna stawka</Text>
              <Text selectable style={{ color: colors.foreground, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
                {totalStake.toFixed(2)} zł
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.muted }}>Możliwa wygrana</Text>
              <Text selectable style={{ color: colors.yellow, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
                {potentialWin.toFixed(2)} zł
              </Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: 11 }}>
              Saldo: {Number(profile?.balance ?? 0).toFixed(2)} zł
            </Text>
          </View>
        ) : null}

        {items.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            disabled={placing || !canPerformWrites || (mode === 'ako' && Boolean(akoConflict))}
            onPress={() => void place()}
            style={({ pressed }) => ({
              minHeight: 56,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 16,
              backgroundColor: colors.primary,
              opacity: placing || !canPerformWrites || (mode === 'ako' && Boolean(akoConflict)) || pressed ? 0.5 : 1,
            })}>
            {placing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>
                Postaw kupon
              </Text>
            )}
          </Pressable>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
