import { MenuView } from '@expo/ui/community/menu';
import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { haptics } from '@/lib/haptics';
import { alpha, createStyles, useScheme, useTheme } from '@/theme';
import { Text } from '@/ui';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

/**
 * shadcn `Select` as a native menu with a checkmark on the current value.
 * The trigger keeps the web look (`h-10 rounded-md border border-input px-3`,
 * chevron at 50% opacity); callers pass the per-site overrides (`h-11 rounded-xl`).
 */
export function SelectField<T extends string>({
  value,
  options,
  onChange,
  placeholder,
  accessibilityLabel,
  disabled,
  triggerStyle,
}: {
  value: T | '';
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  accessibilityLabel: string;
  disabled?: boolean;
  triggerStyle?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const scheme = useScheme();
  // The native menu host sizes itself to its content, so the trigger gets the
  // measured width of the field explicitly.
  const [width, setWidth] = useState<number | undefined>(undefined);
  const selected = options.find((option) => option.value === value);
  const shownLabel = selected?.label ?? placeholder ?? '';

  const trigger = (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: shownLabel }}
      accessibilityState={{ disabled: !!disabled }}
      style={[styles.trigger, triggerStyle, width !== undefined && { width }, disabled && styles.disabled]}
    >
      <Text numberOfLines={1} color={selected ? 'foreground' : 'mutedForeground'} style={styles.label}>
        {shownLabel}
      </Text>
      <ChevronDown size={16} color={alpha(colors.foreground, 0.5)} />
    </View>
  );

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {disabled || width === undefined ? (
        trigger
      ) : (
        <MenuView
          colorScheme={scheme}
          actions={options.map((option) => ({
            id: option.value,
            title: option.label,
            state: option.value === value ? 'on' : 'off',
          }))}
          onPressAction={({ nativeEvent }) => {
            const next = options.find((option) => option.value === nativeEvent.event);
            if (!next) return;
            haptics.selection();
            onChange(next.value);
          }}
        >
          {trigger}
        </MenuView>
      )}
    </View>
  );
}

const useStyles = createStyles(({ colors, radius }) => ({
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
  label: { flex: 1 },
  disabled: { opacity: 0.5 },
}));
