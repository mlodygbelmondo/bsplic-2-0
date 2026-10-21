import { Pressable, View } from 'react-native';

import { haptics } from '@/lib/haptics';
import { createStyles } from '@/theme';
import { Text } from '@/ui';
import { social } from '../components/socialColors';
import { Spinner } from '../components/Spinner';
import type { MentionUser } from './api';

interface MentionSuggestionsProps {
  loading: boolean;
  users: MentionUser[];
  onSelect: (username: string) => void;
}

/** Web `MentionSuggestions`: loading row, then up to six `@username` rows. */
export function MentionSuggestions({ loading, users, onSelect }: MentionSuggestionsProps) {
  const styles = useStyles();

  if (loading) {
    return (
      <View style={[styles.box, styles.loadingBox]}>
        <Spinner size={14} color={social.mutedForeground} />
        <Text style={styles.loadingText}>Szukanie użytkowników...</Text>
      </View>
    );
  }

  if (users.length === 0) return null;

  return (
    <View style={[styles.box, styles.listBox]}>
      <Text style={styles.header}>Wspomnij użytkownika</Text>
      <View style={styles.list}>
        {users.map((user) => (
          <Pressable
            key={user.id}
            accessibilityRole="button"
            accessibilityLabel={`@${user.username}`}
            onPress={() => {
              haptics.selection();
              onSelect(user.username);
            }}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <Text numberOfLines={1} style={styles.rowText}>
              @{user.username}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const useStyles = createStyles(() => ({
  // `rounded-lg border border-border bg-popover`.
  box: { borderRadius: 8, borderWidth: 1, borderColor: social.border, backgroundColor: social.popover },
  // `p-2 text-xs`, `flex items-center gap-1.5`.
  loadingBox: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8 },
  loadingText: { fontSize: 12, lineHeight: 16, color: social.mutedForeground },
  listBox: { padding: 4 },
  // `text-[11px] text-muted-foreground px-2 py-1`.
  header: { paddingHorizontal: 8, paddingVertical: 4, fontSize: 11, lineHeight: 16, color: social.mutedForeground },
  list: { gap: 2 },
  // `rounded-md px-2 py-1.5 text-sm`; 36 pt rows (web 32) for touch.
  row: { minHeight: 36, justifyContent: 'center', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6 },
  rowPressed: { backgroundColor: social.muted },
  rowText: { fontSize: 14, lineHeight: 20, color: social.foreground },
}));
