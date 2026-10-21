import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { CalendarClock } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { toInputDateTime } from '@/lib/date-input';
import { createStyles, useScheme, useTheme } from '@/theme';
import { Text } from '@/ui';

const toDate = (value: string): Date => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const formatValue = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Web `<input type="datetime-local">`. The value stays in the same
 * `YYYY-MM-DDTHH:mm` local format so form validation matches the web.
 * iOS: compact native date + time picker. Android: date dialog, then time dialog.
 */
export function DateTimeField({
  value,
  onChange,
  accessibilityLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  accessibilityLabel: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const scheme = useScheme();
  const [androidStep, setAndroidStep] = useState<'date' | 'time' | null>(null);
  const [androidDraft, setAndroidDraft] = useState<Date | null>(null);

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.iosRow} accessibilityLabel={accessibilityLabel}>
        <DateTimePicker
          value={toDate(value)}
          mode="datetime"
          display="compact"
          locale="pl_PL"
          themeVariant={scheme}
          accentColor={colors.primary}
          onValueChange={(_event, date) => onChange(toInputDateTime(date))}
        />
      </View>
    );
  }

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ text: formatValue(value) }}
        onPress={() => {
          setAndroidDraft(toDate(value));
          setAndroidStep('date');
        }}
        style={styles.trigger}
      >
        <Text style={{ flex: 1 }}>{formatValue(value)}</Text>
        <CalendarClock size={16} color={colors.mutedForeground} />
      </Pressable>
      {androidStep === 'date' && androidDraft ? (
        <DateTimePicker
          value={androidDraft}
          mode="date"
          presentation="dialog"
          accentColor={colors.primary}
          onDismiss={() => setAndroidStep(null)}
          onValueChange={(_event, date) => {
            setAndroidDraft(date);
            setAndroidStep('time');
          }}
        />
      ) : null}
      {androidStep === 'time' && androidDraft ? (
        <DateTimePicker
          value={androidDraft}
          mode="time"
          is24Hour
          presentation="dialog"
          accentColor={colors.primary}
          onDismiss={() => setAndroidStep(null)}
          onValueChange={(_event, date) => {
            setAndroidStep(null);
            onChange(toInputDateTime(date));
          }}
        />
      ) : null}
    </View>
  );
}

const useStyles = createStyles(({ colors, radius }) => ({
  iosRow: { flexDirection: 'row', alignItems: 'center', minHeight: 40 },
  trigger: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
  },
}));
