import { X } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { createStyles, useTheme } from '@/theme';
import { DialogModal, PressScale, Text } from '@/ui';

const TITLE = 'Skąd bierze się Jackpot?';
const BODY =
  'Pula Jackpotu bierze się z 20% stawek przegranych kuponów z poprzedniego dnia oraz z kupionych ticketów w aktualnym losowaniu. Im większy ruch w grze, tym większa pula do zgarnięcia.';

/**
 * Web `DailyJackpotCard` info dialog: `DialogContent max-w-md border-red-500/40
 * bg-zinc-950 text-white shadow-2xl`, centered header on phones, full-width
 * secondary "Zamknij" footer button and the shadcn corner X.
 */
export function JackpotInfoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <DialogModal
      visible={open}
      onRequestClose={onClose}
      onBackdropPress={onClose}
      maxWidth={448}
      cardStyle={styles.card}
      accessibilityLabel={TITLE}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{TITLE}</Text>
        <Text style={styles.body}>{BODY}</Text>
      </View>
      <PressScale accessibilityRole="button" onPress={onClose} style={[styles.button, { backgroundColor: colors.secondary }]}>
        <Text style={[styles.buttonText, { color: colors.secondaryForeground }]}>Zamknij</Text>
      </PressScale>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Zamknij"
        hitSlop={14}
        onPress={onClose}
        style={styles.close}
      >
        <X size={16} color="#ffffff" />
      </Pressable>
    </DialogModal>
  );
}

const useStyles = createStyles(({ radius }) => ({
  // `p-6 grid gap-4`, red border, zinc-950, `shadow-2xl`.
  card: {
    gap: 16,
    padding: 24,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    backgroundColor: '#09090b',
    boxShadow: '0px 25px 50px -12px rgba(0, 0, 0, 0.25)',
  },
  // `flex flex-col space-y-1.5 text-center`.
  header: { gap: 6 },
  // `text-lg font-semibold leading-none tracking-tight`.
  title: { fontSize: 18, lineHeight: 18, fontWeight: '600', letterSpacing: -0.45, textAlign: 'center', color: '#ffffff' },
  // `text-sm leading-6 text-zinc-200`.
  body: { fontSize: 14, lineHeight: 24, textAlign: 'center', color: '#e4e4e7' },
  // Button `variant="secondary"`: `h-10 px-4 py-2 rounded-md text-sm font-medium`.
  button: { height: 40, paddingHorizontal: 16, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  // `absolute right-4 top-4 opacity-70`.
  close: { position: 'absolute', top: 16, right: 16, opacity: 0.7 },
}));
