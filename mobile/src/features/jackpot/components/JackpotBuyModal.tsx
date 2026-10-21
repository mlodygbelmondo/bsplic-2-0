import { Coins, Sparkles, X } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';

import { OFFLINE_WRITE_MESSAGE } from '@/lib/connectivity';
import { haptics } from '@/lib/haptics';
import { createStyles, useTheme } from '@/theme';
import { PressScale, Text } from '@/ui';

import { formatTicketCount, getJackpotBuyModel } from '../lib/buyModel';
import { jackpotAudio } from '../lib/jackpotAudio';
import { formatJackpotAmount } from '../lib/jackpotFormat';
import { SpinningLoader } from './SpinningLoader';

// Tailwind palette used by the web dialog.
const AMBER_300 = '#fcd34d';
const AMBER_400 = '#fbbf24';
const AMBER_500 = '#f59e0b';
const YELLOW_500 = '#eab308';
const ZINC_400 = '#a1a1aa';
const ZINC_900 = '#18181b';
const ZINC_950 = '#09090b';
const amber500 = (a: number) => `rgba(245, 158, 11, ${a})`;
const white = (a: number) => `rgba(255, 255, 255, ${a})`;

/** shadcn `DialogContent` open animation: fade-in, zoom-in-95 and a 2 % rise, 200 ms. */
const DIALOG_ENTER = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 9 }, { scale: 0.95 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: Easing.bezier(0.25, 0.1, 0.25, 1) },
}).duration(200);

interface JackpotBuyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketPrice: number;
  prizeAmount: number;
  balance: number;
  currentTicketCount: number;
  maxTicketsPerPlayer: number;
  minUniqueUsers: number;
  drawTimeLabel: string;
  buying: boolean;
  offline: boolean;
  /** Resolves `true` once every ticket was bought. */
  onConfirm: (count: number) => Promise<boolean>;
}

/**
 * Purchase confirmation before anything is charged (web `JackpotBuyModal`):
 * pick 1–2 tickets within the balance and the per-player limit, read the
 * rules, then confirm. It cannot be dismissed while the purchase runs.
 */
export function JackpotBuyModal({
  open,
  onOpenChange,
  ticketPrice,
  prizeAmount,
  balance,
  currentTicketCount,
  maxTicketsPerPlayer,
  minUniqueUsers,
  drawTimeLabel,
  buying,
  offline,
  onConfirm,
}: JackpotBuyModalProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const [requestedCount, setRequestedCount] = useState(1);
  const model = getJackpotBuyModel({
    ticketPrice,
    balance,
    currentTicketCount,
    maxTicketsPerPlayer,
    requestedCount,
    buying,
  });
  const canConfirm = model.canConfirm && !offline;
  const confirmLabel = offline ? OFFLINE_WRITE_MESSAGE : model.confirmLabel;
  const width = Math.min(windowWidth - 1.5 * 16, 28 * 16);
  const optionWidth = model.quantityOptions.length > 1 ? (width - 2 - 2 * 20 - 12) / 2 : undefined;

  const close = () => {
    if (buying) return;
    setRequestedCount(1);
    onOpenChange(false);
  };

  const confirmPurchase = async () => {
    if (!canConfirm) return;
    const purchased = await onConfirm(model.count);
    if (purchased) {
      jackpotAudio.playCoin();
      setRequestedCount(1);
      onOpenChange(false);
    }
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={close}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Zamknij"
          importantForAccessibility="no"
          accessibilityElementsHidden
        />
        <Animated.View entering={DIALOG_ENTER} style={[styles.shadow, { width }]}>
          <View style={styles.card} accessibilityViewIsModal accessibilityLabel="Kup ticket">
            <View style={styles.header}>
              <View style={styles.headerRow}>
                <View style={styles.pill}>
                  <Sparkles size={14} color={AMBER_300} />
                  <Text style={styles.pillText}>Jackpot Dnia</Text>
                </View>
                <Text style={styles.balance}>
                  Saldo: <Text style={styles.balanceValue}>{formatJackpotAmount(balance)}</Text>
                </Text>
              </View>
              <View style={styles.titleRow}>
                <Text style={styles.title} accessibilityRole="header">
                  Kup ticket
                </Text>
                <Text style={styles.titlePool}>Pula {formatJackpotAmount(prizeAmount)}</Text>
              </View>
              <Text style={styles.description}>
                Cena ticketu <Text style={styles.descriptionPrice}>{formatJackpotAmount(ticketPrice)}</Text> • Twoje
                tickety {currentTicketCount}/{maxTicketsPerPlayer}
              </Text>
            </View>

            <View style={styles.body}>
              <View style={styles.options} accessibilityLabel="Liczba ticketów">
                {model.quantityOptions.map((option) => {
                  const unaffordable = option > model.affordableCount;
                  const selected = model.count === option;
                  return (
                    <Pressable
                      key={option}
                      accessibilityRole="button"
                      accessibilityLabel={`${formatTicketCount(option)}, ${formatJackpotAmount(option * ticketPrice)}`}
                      accessibilityState={{ selected, disabled: unaffordable || buying }}
                      disabled={unaffordable || buying}
                      onPress={() => {
                        haptics.selection();
                        jackpotAudio.playOptionTick(option);
                        setRequestedCount(option);
                      }}
                      style={[
                        styles.option,
                        optionWidth === undefined ? styles.optionFull : { width: optionWidth },
                        selected ? styles.optionSelected : styles.optionIdle,
                        unaffordable && styles.optionUnaffordable,
                      ]}
                    >
                      <Coins size={24} color={AMBER_400} style={styles.optionIcon} />
                      <Text style={styles.optionCount}>{formatTicketCount(option)}</Text>
                      <Text style={styles.optionPrice}>{formatJackpotAmount(option * ticketPrice)}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.rules}>
                <Text style={styles.rule}>{drawTimeLabel}. Zwycięski ticket losujemy spośród wszystkich kupionych.</Text>
                <Text style={styles.rule}>Numery ticketów nadajemy po kolei w chwili zakupu.</Text>
                <Text style={styles.rule}>
                  Jeśli zagra mniej niż {minUniqueUsers} graczy, ticket wraca na saldo, a pula przechodzi na kolejny
                  dzień.
                </Text>
              </View>
            </View>

            <View style={styles.footer}>
              <View>
                <Text style={styles.totalLabel}>Do zapłaty</Text>
                <Text style={styles.total}>{formatJackpotAmount(model.total)}</Text>
              </View>
              <PressScale
                scaleTo={0.97}
                accessibilityRole="button"
                accessibilityLabel={buying ? 'Kupowanie…' : confirmLabel}
                accessibilityState={{ disabled: !canConfirm, busy: buying }}
                disabled={!canConfirm}
                onPress={() => void confirmPurchase()}
                style={[styles.confirm, !canConfirm && styles.confirmDisabled]}
              >
                {buying ? <SpinningLoader size={16} color="#000" /> : null}
                <Text style={styles.confirmText} numberOfLines={1}>
                  {buying ? 'Kupowanie…' : confirmLabel}
                </Text>
              </PressScale>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Zamknij"
              hitSlop={14}
              onPress={close}
              style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
            >
              <X size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const useStyles = createStyles(({ colors, radius }) => ({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  // shadow-2xl shadow-amber-950/40
  shadow: {
    borderRadius: 16,
    boxShadow: '0px 25px 50px -12px rgba(69, 26, 3, 0.4)',
  },
  card: {
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: amber500(0.3),
    backgroundImage: `linear-gradient(to bottom, ${ZINC_950}, ${ZINC_900}, #000000)`,
  },
  header: {
    gap: 8,
    padding: 20,
    paddingRight: 48,
    borderBottomWidth: 1,
    borderBottomColor: white(0.1),
    backgroundColor: 'rgba(24, 24, 27, 0.6)',
  },
  headerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 12,
    rowGap: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: amber500(0.3),
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
    backgroundColor: amber500(0.1),
  },
  pillText: { color: AMBER_300, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  balance: { color: ZINC_400, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  balanceValue: { color: '#ffffff', fontWeight: '900' },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    columnGap: 12,
    rowGap: 4,
  },
  title: { color: '#ffffff', fontSize: 20, lineHeight: 28, fontWeight: '900', letterSpacing: -0.5 },
  titlePool: { color: AMBER_400, fontSize: 18, lineHeight: 28, fontWeight: '800', letterSpacing: -0.45 },
  description: { color: ZINC_400, fontSize: 12, lineHeight: 16 },
  descriptionPrice: { color: AMBER_300, fontWeight: '700' },
  body: { gap: 16, padding: 20 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  option: { alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 16 },
  optionFull: { width: '100%' },
  optionSelected: { borderColor: AMBER_400, backgroundColor: amber500(0.1) },
  optionIdle: { borderColor: white(0.1), backgroundColor: 'rgba(24, 24, 27, 0.5)' },
  optionUnaffordable: { opacity: 0.4 },
  optionIcon: { marginBottom: 4 },
  optionCount: { color: '#ffffff', fontSize: 14, lineHeight: 20, fontWeight: '900', textAlign: 'center' },
  optionPrice: { color: AMBER_300, fontSize: 12, lineHeight: 16, fontWeight: '700', textAlign: 'center' },
  rules: {
    gap: 6,
    borderWidth: 1,
    borderColor: white(0.1),
    borderRadius: radius.lg,
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  rule: { color: ZINC_400, fontSize: 12, lineHeight: 20 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: white(0.1),
    backgroundColor: ZINC_950,
  },
  totalLabel: { color: ZINC_400, fontSize: 11, lineHeight: 16.5 },
  total: { color: '#ffffff', fontSize: 18, lineHeight: 28, fontWeight: '900' },
  confirm: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundImage: `linear-gradient(to right, ${AMBER_400}, ${AMBER_500}, ${YELLOW_500})`,
    boxShadow: `0px 10px 15px -3px ${amber500(0.2)}, 0px 4px 6px -4px ${amber500(0.2)}`,
  },
  confirmDisabled: { opacity: 0.5 },
  confirmText: { flexShrink: 1, color: '#000000', fontSize: 14, lineHeight: 20, fontWeight: '900' },
  close: {
    position: 'absolute',
    top: 16,
    right: 16,
    borderRadius: radius.sm,
    opacity: 0.7,
    backgroundColor: colors.accent,
  },
  closePressed: { opacity: 1 },
}));
