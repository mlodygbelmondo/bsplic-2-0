import { Pressable, View } from 'react-native';

import { useBalance } from '@/features/auth/auth-store';
import { alpha, createStyles } from '@/theme';
import { Avatar, Text } from '@/ui';
import { useSurfaceStyles } from './surfaces';

interface AvatarUploadControl {
  uploading: boolean;
  offline: boolean;
  onPick: () => void;
}

interface ProfileHeaderCardProps {
  displayName: string;
  displayDate: string;
  avatarUrl: string | null;
  isOwnProfile: boolean;
  /** Own profile only: "Wybierz zdjęcie profilowe". */
  avatarUpload?: AvatarUploadControl;
}

/** Web `ProfilePage` header card: avatar, name, join date, balance and avatar picker (own). */
export function ProfileHeaderCard({ displayName, displayDate, avatarUrl, isOwnProfile, avatarUpload }: ProfileHeaderCardProps) {
  const surfaces = useSurfaceStyles();
  const styles = useStyles();

  return (
    <View style={[surfaces.card, styles.card]}>
      <View style={styles.topRow}>
        <View style={styles.identity}>
          <Avatar
            uri={avatarUrl}
            name={displayName}
            size={56}
            style={styles.avatar}
            fallbackTextStyle={styles.avatarFallbackText}
          />
          <View style={styles.identityText}>
            <Text size="2xl" weight="700" accessibilityRole="header">
              {displayName}
            </Text>
            <View style={styles.metaLine}>
              <Text color="mutedForeground">Dołączył: {displayDate}</Text>
              {!isOwnProfile ? (
                <View style={styles.publicBadge}>
                  <Text size="xs">Profil publiczny</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
        {isOwnProfile ? <OwnBalance /> : null}
      </View>

      {avatarUpload ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={avatarUpload.uploading ? 'Przesyłanie...' : 'Wybierz zdjęcie profilowe'}
          accessibilityState={{ disabled: avatarUpload.uploading || avatarUpload.offline, busy: avatarUpload.uploading }}
          disabled={avatarUpload.uploading}
          hitSlop={{ top: 8, bottom: 8 }}
          onPress={avatarUpload.onPick}
          style={({ pressed }) => [
            styles.uploadButton,
            pressed && styles.uploadButtonPressed,
            avatarUpload.offline && styles.uploadButtonDisabled,
          ]}
        >
          <Text size="xs" weight="600">
            {avatarUpload.uploading ? 'Przesyłanie...' : 'Wybierz zdjęcie profilowe'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Subscribes to the balance alone so a balance tick re-renders only this block. */
function OwnBalance() {
  const styles = useStyles();
  const balance = useBalance();
  return (
    <View style={styles.balance}>
      <Text color="mutedForeground">Saldo</Text>
      <Text size="2xl" weight="700" color="primary" tabular>
        {Number(balance).toFixed(2)} zł
      </Text>
    </View>
  );
}

const useStyles = createStyles(({ colors, radius }) => ({
  card: { padding: 24 },
  // mb-4 stays on the row on public profiles too (the web card keeps the gap).
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  identity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { borderWidth: 1, borderColor: colors.border },
  avatarFallbackText: { fontSize: 16, lineHeight: 24, color: colors.foreground },
  identityText: { flexShrink: 1, minWidth: 0 },
  metaLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8 },
  publicBadge: { borderRadius: 9999, backgroundColor: colors.muted, paddingHorizontal: 8, paddingVertical: 2 },
  balance: { alignItems: 'flex-end', flexShrink: 0 },
  uploadButton: {
    alignSelf: 'flex-start',
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: colors.muted,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  uploadButtonPressed: { backgroundColor: alpha(colors.muted, 0.8) },
  uploadButtonDisabled: { opacity: 0.5 },
}));
