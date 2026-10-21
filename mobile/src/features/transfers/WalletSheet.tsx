import { router, Stack, useLocalSearchParams } from 'expo-router';
import { WalletCards, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { BackHandler, Pressable, View } from 'react-native';

import { useBalance, useProfile } from '@/features/auth/auth-store';
import { haptics } from '@/lib/haptics';
import { alpha, createStyles, useTheme } from '@/theme';
import { SectionLoader, Text } from '@/ui';
import { formatMoney } from './format';
import { MoneyTransferHistory } from './MoneyTransferHistory';
import { MoneyTransferSend } from './MoneyTransferSend';

type WalletTab = 'send' | 'history';

const TABS: readonly { value: WalletTab; label: string }[] = [
  { value: 'send', label: 'Wyślij' },
  { value: 'history', label: 'Historia' },
];

/**
 * `/sheets/wallet?tab=send|history&recipient=<userId>` — port of the web
 * `MoneyTransferDialog` as a native form sheet.
 */
export function WalletSheet() {
  const styles = useStyles();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ tab?: string; recipient?: string }>();
  const profileCreatedAt = useProfile()?.created_at ?? null;
  const balance = Number(useBalance());
  const [tab, setTab] = useState<WalletTab>(params.tab === 'history' ? 'history' : 'send');
  const [submitting, setSubmitting] = useState(false);

  // A transfer in flight cannot be dismissed (web ignores close while submitting).
  useEffect(() => {
    if (!submitting) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [submitting]);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ gestureEnabled: !submitting }} />
      <View style={styles.header}>
        <View style={styles.iconTile}>
          <WalletCards size={20} color={colors.primary} />
        </View>
        <Text size="xl" weight="600" accessibilityRole="header" style={styles.title}>
          Portfel
        </Text>
        <Text color="mutedForeground" style={styles.description}>
          Dostępne saldo:{' '}
          <Text weight="700" tabular>
            {formatMoney(balance)} zł
          </Text>
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zamknij"
          accessibilityState={{ disabled: submitting }}
          disabled={submitting}
          hitSlop={14}
          onPress={() => router.back()}
          style={styles.close}
        >
          <X size={16} color={colors.foreground} />
        </Pressable>
      </View>

      <View style={styles.tabsWrap}>
        <View style={styles.tabsList} accessibilityRole="tablist">
          {TABS.map(({ value, label }) => {
            const active = tab === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                hitSlop={{ top: 6, bottom: 6 }}
                onPress={() => {
                  if (active) return;
                  haptics.selection();
                  setTab(value);
                }}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text weight="500" color={active ? 'primaryForeground' : 'mutedForeground'}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.body}>
        {profileCreatedAt === null ? (
          <SectionLoader size="sm" />
        ) : tab === 'send' ? (
          <MoneyTransferSend
            balance={balance}
            profileCreatedAt={profileCreatedAt}
            initialRecipientId={params.recipient || undefined}
            onCompleted={() => setTab('history')}
            onSubmittingChange={setSubmitting}
          />
        ) : (
          <MoneyTransferHistory />
        )}
      </View>
    </View>
  );
}

const useStyles = createStyles(({ colors, radius }) => ({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: alpha(colors.border, 0.7),
    backgroundImage: `linear-gradient(to bottom right, ${alpha(colors.primary, 0.12)}, ${alpha(colors.primary, 0.05)}, ${alpha(colors.primary, 0)})`,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  iconTile: {
    width: 40,
    height: 40,
    marginBottom: 8,
    borderRadius: 12,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(colors.primary, 0.12),
  },
  title: { marginTop: 6, lineHeight: 22, letterSpacing: -0.5 },
  description: { marginTop: 6 },
  close: { position: 'absolute', top: 16, right: 16, padding: 2, opacity: 0.7 },
  tabsWrap: { paddingHorizontal: 20, paddingTop: 16 },
  tabsList: {
    height: 40,
    flexDirection: 'row',
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: alpha(colors.muted, 0.6),
    padding: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderCurve: 'continuous',
    paddingHorizontal: 12,
  },
  tabActive: { backgroundColor: colors.primary, boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)' },
  body: { flex: 1 },
}));
