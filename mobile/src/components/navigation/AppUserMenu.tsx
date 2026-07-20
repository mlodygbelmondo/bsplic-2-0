import { Bell, CreditCard, LogOut, Moon, Plus, Send, ShieldCheck, Sun, UserRound } from 'lucide-react-native';
import { StyleSheet, View, type ImageSourcePropType } from 'react-native';

import { AppModal } from '@/components/ui/AppModal';
import { AccessiblePressable } from '@/components/ui/AccessiblePressable';
import { AppAvatar } from '@/components/ui/AppAvatar';
import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/hooks/use-app-theme';

export interface AppUserMenuProps {
  visible: boolean;
  onClose(): void;
  username?: string;
  avatarSource?: ImageSourcePropType;
  balance?: number;
  canTopup?: boolean;
  isAdmin?: boolean;
  onTopup?: () => void;
  onTransfer?: () => void;
  onProfile?: () => void;
  onNotifications?: () => void;
  onAdmin?: () => void;
  onLogout: () => void | Promise<void>;
}

export function AppUserMenu({
  visible,
  onClose,
  username,
  avatarSource,
  balance,
  canTopup = true,
  isAdmin = false,
  onTopup,
  onTransfer,
  onProfile,
  onNotifications,
  onAdmin,
  onLogout,
}: AppUserMenuProps) {
  const { theme, tokens, toggleTheme } = useAppTheme();

  const runAndClose = (action?: () => void | Promise<void>) => {
    if (!action) return;
    onClose();
    void action();
  };

  return (
    <AppModal visible={visible} title="Menu" onClose={onClose} presentation="sheet">
      {username ? (
        <AccessiblePressable accessibilityLabel={`Otwórz profil ${username}`} onPress={() => runAndClose(onProfile)} style={styles.profile}>
          <AppAvatar name={username} source={avatarSource} size={44} />
          <View style={styles.profileText}>
            <AppText variant="label">{username}</AppText>
            {typeof balance === 'number' ? <AppText tone="muted">Saldo: {balance.toFixed(2)} zł</AppText> : null}
          </View>
          <UserRound color={tokens.colors.mutedForeground} size={20} />
        </AccessiblePressable>
      ) : null}

      <View style={[styles.wallet, { backgroundColor: tokens.colors.muted, borderColor: tokens.colors.border }]}>
        <CreditCard color={tokens.colors.primary} size={20} />
        <AppText variant="label" style={styles.grow}>Portfel</AppText>
        {typeof balance === 'number' ? <AppText variant="label">{balance.toFixed(2)} zł</AppText> : null}
      </View>

      <View style={styles.buttons}>
        {onTopup ? (
          <AppButton
            variant="secondary"
            disabled={!canTopup}
            onPress={() => runAndClose(onTopup)}
            leftAccessory={<Plus color={tokens.colors.primary} size={17} />}
            fullWidth
          >
            {canTopup ? 'Doładuj 100 zł' : 'Doładowanie dostępne jutro'}
          </AppButton>
        ) : null}
        {onTransfer ? (
          <AppButton variant="outline" onPress={() => runAndClose(onTransfer)} leftAccessory={<Send color={tokens.colors.primary} size={17} />} fullWidth>
            Wyślij pieniądze
          </AppButton>
        ) : null}
        {onNotifications ? (
          <MenuRow label="Powiadomienia" icon={Bell} onPress={() => runAndClose(onNotifications)} />
        ) : null}
        {onProfile ? <MenuRow label="Profil" icon={UserRound} onPress={() => runAndClose(onProfile)} /> : null}
        {isAdmin && onAdmin ? <MenuRow label="Admin" icon={ShieldCheck} onPress={() => runAndClose(onAdmin)} /> : null}
        <MenuRow
          label={theme === 'dark' ? 'Tryb jasny' : 'Tryb ciemny'}
          icon={theme === 'dark' ? Sun : Moon}
          onPress={toggleTheme}
        />
        <MenuRow label="Wyloguj się" icon={LogOut} onPress={() => runAndClose(onLogout)} danger />
      </View>
    </AppModal>
  );
}

function MenuRow({
  label,
  icon: Icon,
  onPress,
  danger = false,
}: {
  label: string;
  icon: typeof UserRound;
  onPress(): void;
  danger?: boolean;
}) {
  const { tokens } = useAppTheme();
  const color = danger ? tokens.colors.destructive : tokens.colors.foreground;
  return (
    <AccessiblePressable accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: tokens.colors.muted }]}>
      <Icon color={color} size={19} />
      <AppText variant="label" style={{ color }}>{label}</AppText>
    </AccessiblePressable>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  profileText: { flex: 1 },
  wallet: { marginTop: 12, borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  grow: { flex: 1 },
  buttons: { marginTop: 16, gap: 8 },
  row: { minHeight: 48, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12 },
});
