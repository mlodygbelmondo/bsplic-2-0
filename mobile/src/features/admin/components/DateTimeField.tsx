import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { CalendarClock } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { createStyles, useScheme, useTheme } from '@/theme';
import { Text } from '@/ui';

const isValid = (date: Date) => !Number.isNaN(date.getTime());

const withMinutePrecision = (date: Date) => {
  const next = new Date(date);
  next.setSeconds(0, 0);
  return next;
};

const formatValue = (date: Date): string =>
  isValid(date)
    ? date.toLocaleString('pl-PL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

/**
 * Web `<input type="datetime-local">` in device-local time with minute
 * precision. iOS: the compact native date and time pickers. Android: a date
 * dialog followed by a time dialog.
 */
export function DateTimeField({
  value,
  onChange,
  accessibilityLabel,
  disabled,
}: {
  value: Date;
  onChange: (value: Date) => void;
  accessibilityLabel: string;
  disabled?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const scheme = useScheme();
  const [androidStep, setAndroidStep] = useState<'date' | 'time' | null>(null);
  const [androidDraft, setAndroidDraft] = useState<Date | null>(null);
  const pickerValue = isValid(value) ? value : new Date();

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.iosRow} accessibilityLabel={accessibilityLabel}>
        <DateTimePicker
          value={pickerValue}
          mode="datetime"
          display="compact"
          locale="pl_PL"
          themeVariant={scheme}
          accentColor={colors.primary}
          disabled={disabled}
          onValueChange={(_event, date) => onChange(withMinutePrecision(date))}
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
        disabled={disabled}
        onPress={() => {
          setAndroidDraft(pickerValue);
          setAndroidStep('date');
        }}
        style={[styles.trigger, disabled && styles.disabled]}
      >
        <Text size="base" style={styles.flex}>
          {formatValue(value)}
        </Text>
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
            onChange(withMinutePrecision(date));
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
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
  },
  flex: { flex: 1 },
  disabled: { opacity: 0.5 },
}));
