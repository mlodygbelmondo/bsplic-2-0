import { useLocalSearchParams } from 'expo-router';
import { WalletCards, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { useBalance, useProfile } from '@/features/auth/auth-store';
import { haptics } from '@/lib/haptics';
import { alpha, createStyles, useTheme } from '@/theme';
import { OverlayScreen, SectionLoader, Text, useOverlayClose } from '@/ui';
import { formatMoney } from './format';
import { MoneyTransferHistory } from './MoneyTransferHistory';
import { MoneyTransferSend } from './MoneyTransferSend';

type WalletTab = 'send' | 'history';

const TABS: readonly { value: WalletTab; label: string }[] = [
  { value: 'send', label: 'Wyślij' },
  { value: 'history', label: 'Historia' },
];

/**
 * `/sheets/wallet?tab=send|history&recipient=<userId>` — the web
 * `MoneyTransferDialog`: a centered dialog with a gradient header, two tabs and
 * a fixed-height scrolling tab body (`h-[min(430px,calc(100dvh-13rem))]`).
 */
export function WalletSheet() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const close = useOverlayClose();
  const params = useLocalSearchParams<{ tab?: string; recipient?: string }>();
  const profileCreatedAt = useProfile()?.created_at ?? null;
  const balance = Number(useBalance());
  const [tab, setTab] = useState<WalletTab>(params.tab === 'history' ? 'history' : 'send');
  const [submitting, setSubmitting] = useState(false);

  return (
    <OverlayScreen
      variant="dialog"
      style={[styles.card, { width: width - 20 }]}
      accessibilityLabel="Portfel"
      dismissible={!submitting}
    >
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
      </View>

      <View style={styles.tabsWrap}>
        <View style={styles.tabsList} accessibilityRole="tablist">
          {TABS.map(({ value, label }) => {
            const active = tab === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="tab"
                // Leaving the send form mid-transfer would drop its retry key.
                accessibilityState={{ selected: active, disabled: submitting }}
                disabled={submitting}
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

      <View style={[styles.body, { height: Math.min(430, height - 208) }]}>
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

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Zamknij"
        accessibilityState={{ disabled: submitting }}
        disabled={submitting}
        hitSlop={14}
        onPress={() => close()}
        style={styles.close}
      >
        <X size={16} color={colors.foreground} />
      </Pressable>
    </OverlayScreen>
  );
}

const useStyles = createStyles(({ colors, radius }) => ({
  // DialogContent: w-[calc(100%-1.25rem)] max-w-lg overflow-hidden rounded-2xl border-border/70 p-0 (grid gap-4).
  card: {
    maxWidth: 512,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderColor: alpha(colors.border, 0.7),
  },
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
  // DialogTitle text-xl (20/28, leading-none is merged away) tracking-tight; DialogHeader space-y-1.5.
  title: { marginTop: 6, letterSpacing: -0.5 },
  description: { marginTop: 6 },
  close: { position: 'absolute', top: 16, right: 16, opacity: 0.7 },
  // DialogContent gap-4 between the header and the Tabs root, then the list wrapper's pt-4.
  tabsWrap: { marginTop: 16, paddingHorizontal: 20, paddingTop: 16 },
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
  // Shrinks below its web height when the keyboard leaves less room; the tab body scrolls inside it.
  body: { flexShrink: 1 },
}));
