import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { authActions, useAuthStore, useUserId } from '@/features/auth/auth-store';
import { OFFLINE_WRITE_MESSAGE, useIsOffline } from '@/lib/connectivity';
import { haptics } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { createStyles, useTheme } from '@/theme';
import { Button, Text } from '@/ui';

const TOPUP_ERROR_MESSAGE = 'Błąd doładowania';

/** Daily top-up (web `NavbarTopupDialog`): +100 zł once per Warsaw calendar day. */
export function TopupSheet() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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
        toast.error(error.message || TOPUP_ERROR_MESSAGE);
        return;
      }
      // The RPC returns the new balance: show it right away, then refetch the
      // profile so `last_topup_at` locks the chip until tomorrow.
      if (typeof data === 'number') authActions.updateProfileBalance(data);
      await authActions.refreshProfile();
      haptics.success();
      toast.success('💰 Doładowano 100 zł. Wróć jutro po więcej!');
      router.back();
    } catch {
      toast.error(TOPUP_ERROR_MESSAGE);
    } finally {
      setTopupLoading(false);
    }
  };

  return (
    <View style={[styles.root, { paddingBottom: 20 + insets.bottom }]}>
      <Text size="lg" weight="600" align="center" accessibilityRole="header" style={styles.title}>
        💰 Doładuj portfel
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Zamknij"
        hitSlop={14}
        onPress={() => router.back()}
        style={styles.close}
      >
        <X size={16} color={colors.foreground} />
      </Pressable>

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
    </View>
  );
}

const useStyles = createStyles(({ colors }) => ({
  root: { backgroundColor: colors.background, paddingHorizontal: 20, paddingTop: 20, gap: 16 },
  title: { lineHeight: 20, letterSpacing: -0.45, paddingHorizontal: 24 },
  close: { position: 'absolute', right: 16, top: 16, padding: 2, opacity: 0.7 },
  body: { gap: 16, paddingVertical: 8 },
  // shadcn Button `h-11` with `gradient-primary font-bold` (no shadow on this one).
  button: { height: 44, boxShadow: [] },
}));
