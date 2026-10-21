import { createStyles } from '@/theme';
import { Avatar } from '@/ui';
import { social } from '../components/socialColors';

/** Web `ComposerAvatar`: avatar or the initial of `username || 'T'` on `bg-primary/10 text-primary`. */
export function ComposerAvatar({ username, avatarUrl, size = 40 }: { username?: string; avatarUrl?: string | null; size?: number }) {
  const styles = useStyles();
  return (
    <Avatar
      uri={avatarUrl}
      name={username || 'T'}
      size={size}
      style={styles.avatar}
      fallbackStyle={styles.avatar}
      fallbackTextStyle={styles.text}
    />
  );
}

const useStyles = createStyles(() => ({
  avatar: { backgroundColor: social.primarySoft },
  // `text-sm font-bold text-primary`.
  text: { fontSize: 14, fontWeight: '700', color: social.primary },
}));
