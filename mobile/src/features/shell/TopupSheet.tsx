import { X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { authActions, useAuthStore, useUserId } from '@/features/auth/auth-store';
import { OFFLINE_WRITE_MESSAGE, useIsOffline } from '@/lib/connectivity';
import { getErrorMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { createStyles, useTheme } from '@/theme';
import { Button, OverlayScreen, Text, useOverlayClose } from '@/ui';

const TOPUP_ERROR_MESSAGE = 'Błąd doładowania';

/** Daily top-up (web `NavbarTopupDialog`): +100 zł once per Warsaw calendar day. */
export function TopupSheet() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const close = useOverlayClose();
  const userId = useUserId();
  const hasProfile = useAuthStore((s) => s.profile !== null);
  const offline = useIsOffline();
  const [topupLoading, setTopupLoading] = useState(false);

  const handleTopup = async () => {
    if (!userId || !hasProfile || offline) return;
    setTopupLoading(true);
    try {
      const { data, error } = await supabase.rpc('secure_daily_topup', { p_user_id: userId });
      if (error) {
        haptics.error();
        toast.error(getErrorMessage(error, TOPUP_ERROR_MESSAGE));
        return;
      }
      // The RPC returns the new balance: show it and lock the chip until tomorrow
      // right away, then confirm both with a background profile refetch.
      if (typeof data === 'number') {
        authActions.updateProfileBalance(data, { last_topup_at: new Date().toISOString() });
      }
      haptics.success();
      toast.success('💰 Doładowano 100 zł. Wróć jutro po więcej!');
      close();
      void authActions.refreshProfile();
    } catch (error) {
      toast.error(getErrorMessage(error, TOPUP_ERROR_MESSAGE));
    } finally {
      setTopupLoading(false);
    }
  };

  return (
    // Web DialogContent `w-[calc(100%-1.25rem)] max-w-sm rounded-xl p-5` over the shadcn `grid gap-4` base.
    <OverlayScreen
      variant="dialog"
      accessibilityLabel="💰 Doładuj portfel"
      style={[styles.card, { width: width - 20 }]}
      // While the top-up runs the dialog stays open, so its success closes this dialog and nothing else.
      dismissible={!topupLoading}
    >
      <Text size="lg" weight="600" align="center" accessibilityRole="header" style={styles.title}>
        💰 Doładuj portfel
      </Text>

      <View style={styles.body}>
        <Text color="mutedForeground" align="center">
          Doładuj swój portfel o{' '}
          <Text weight="700">100 zł</Text>. Możesz to zrobić raz dziennie.
        </Text>
        <Button
          variant="gradient"
          label={topupLoading ? 'Ładowanie...' : 'Doładuj 100 zł'}
          disabled={topupLoading || offline}
          onPress={handleTopup}
          fullWidth
          style={styles.button}
        />
        {offline ? (
          <Text size="xs" color="mutedForeground" align="center">
            {OFFLINE_WRITE_MESSAGE}
          </Text>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Zamknij"
        hitSlop={14}
        disabled={topupLoading}
        onPress={() => close()}
        style={styles.close}
      >
        <X size={16} color={colors.foreground} />
      </Pressable>
    </OverlayScreen>
  );
}

const useStyles = createStyles(() => ({
  card: { maxWidth: 384, borderRadius: 12, padding: 20, gap: 16 },
  // DialogTitle `text-lg font-semibold leading-none tracking-tight`.
  title: { lineHeight: 18, letterSpacing: -0.45 },
  // `absolute right-4 top-4 opacity-70`, 16px X; no background (see WORKER-BRIEF).
  close: { position: 'absolute', right: 16, top: 16, opacity: 0.7 },
  // `text-center space-y-4 py-2`.
  body: { gap: 16, paddingVertical: 8 },
  // shadcn Button `h-11` with `gradient-primary font-bold` (no shadow on this one).
  button: { height: 44, boxShadow: [] },
}));
