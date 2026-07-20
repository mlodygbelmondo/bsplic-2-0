import { Bell, Menu, Plus } from 'lucide-react-native';
import { StyleSheet, View, type ImageSourcePropType, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccessiblePressable } from '@/components/ui/AccessiblePressable';
import { AppAvatar } from '@/components/ui/AppAvatar';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/hooks/use-app-theme';

export interface AppHeaderProps extends ViewProps {
  username?: string;
  avatarSource?: ImageSourcePropType;
  balance?: number;
  unreadNotifications?: number;
  topupAvailable?: boolean;
  onPressBalance?: () => void;
  onPressNotifications?: () => void;
  onPressProfile?: () => void;
  onPressMenu: () => void;
}

export function AppHeader({
  username,
  avatarSource,
  balance,
  unreadNotifications = 0,
  topupAvailable = true,
  onPressBalance,
  onPressNotifications,
  onPressProfile,
  onPressMenu,
  style,
  ...props
}: AppHeaderProps) {
  const { tokens } = useAppTheme();
  const insets = useSafeAreaInsets();
  const formattedBalance = Number(balance ?? 0).toFixed(2);

  return (
    <View
      {...props}
      style={[
        styles.header,
        { paddingTop: insets.top, backgroundColor: tokens.colors.navbar, borderBottomColor: `${tokens.colors.primary}47` },
        style,
      ]}
    >
      <View style={styles.row}>
        <AppText tone="inverse" style={styles.brand}>BSPLIC 2.0</AppText>
        <View style={styles.actions}>
          {typeof balance === 'number' && onPressBalance ? (
            <AccessiblePressable
              accessibilityLabel={`Portfel: ${formattedBalance} zł. ${topupAvailable ? 'Doładuj portfel' : 'Doładowanie dostępne jutro'}`}
              onPress={onPressBalance}
              style={({ pressed }) => [styles.wallet, pressed && styles.pressed]}
            >
              <View style={[styles.plus, { backgroundColor: tokens.colors.primary }]}>
                <Plus color="#FFFFFF" size={15} strokeWidth={3} />
              </View>
              <AppText tone="inverse" style={styles.balance}>{formattedBalance} zł</AppText>
            </AccessiblePressable>
          ) : null}
          {onPressNotifications ? (
            <AccessiblePressable
              accessibilityLabel={unreadNotifications ? `Powiadomienia, nieprzeczytane: ${unreadNotifications}` : 'Powiadomienia'}
              onPress={onPressNotifications}
              style={styles.iconButton}
            >
              <Bell color="#FFFFFF" size={21} />
              {unreadNotifications > 0 ? (
                <View style={[styles.unread, { backgroundColor: tokens.colors.selectedYellow }]} />
              ) : null}
            </AccessiblePressable>
          ) : null}
          {username && onPressProfile ? (
            <AccessiblePressable accessibilityLabel={`Profil ${username}`} onPress={onPressProfile} style={styles.avatarButton}>
              <AppAvatar name={username} source={avatarSource} size={30} />
            </AccessiblePressable>
          ) : null}
          <AccessiblePressable accessibilityLabel="Otwórz menu" onPress={onPressMenu} style={styles.iconButton}>
            <Menu color="#FFFFFF" size={25} />
          </AccessiblePressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { borderBottomWidth: StyleSheet.hairlineWidth },
  row: { height: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontSize: 16, lineHeight: 20, fontWeight: '900', fontStyle: 'italic', letterSpacing: -0.4 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  wallet: { minHeight: 36, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)' },
  plus: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  balance: { fontSize: 12, lineHeight: 16, fontWeight: '800' },
  iconButton: { width: 40, alignItems: 'center', justifyContent: 'center' },
  avatarButton: { width: 40, alignItems: 'center', justifyContent: 'center' },
  unread: { position: 'absolute', width: 7, height: 7, borderRadius: 4, top: 8, right: 8 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
});
