import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { haptics } from '@/lib/haptics';
import { createStyles } from '@/theme';
import { normalizeHexColor } from '../logic/categories';
import { FormModal } from './FormModal';
import { NativeColorPicker } from './NativeColorPicker';
import { FormLabel, Input } from './primitives';

const PRESETS = [
  '#dc2626', '#e11d48', '#db2777', '#c026d3', '#9333ea', '#7c3aed',
  '#4f46e5', '#2563eb', '#0284c7', '#0891b2', '#0d9488', '#059669',
  '#16a34a', '#65a30d', '#ca8a04', '#d97706', '#ea580c', '#475569',
];

/**
 * Web `<input type="color">` behind a colored swatch
 * (`rounded-lg border-2 border-border shadow-sm`). Tapping opens a sheet with
 * the system color picker (iOS), presets and a hex field.
 */
export function ColorField({
  value,
  onChange,
  accessibilityLabel,
  height = 44,
}: {
  value: string;
  onChange: (value: string) => void;
  accessibilityLabel: string;
  height?: number;
}) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = (next: string) => {
    const normalized = normalizeHexColor(next);
    if (normalized) onChange(normalized);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ text: value }}
        onPress={() => {
          setDraft(value);
          setOpen(true);
        }}
        style={[styles.swatch, { height, backgroundColor: value }]}
      />
      <FormModal visible={open} title={accessibilityLabel} onClose={() => setOpen(false)}>
        <View style={[styles.preview, { backgroundColor: value }]} />
        <NativeColorPicker
          value={value}
          onChange={(next) => {
            commit(next);
            setDraft(normalizeHexColor(next) ?? next);
          }}
        />
        <View style={styles.grid}>
          {PRESETS.map((preset) => (
            <Pressable
              key={preset}
              accessibilityRole="button"
              accessibilityLabel={preset}
              accessibilityState={{ selected: preset === value }}
              onPress={() => {
                haptics.selection();
                onChange(preset);
                setDraft(preset);
              }}
              style={[styles.preset, { backgroundColor: preset }]}
            >
              {preset === value ? <Check size={18} strokeWidth={3} color="#ffffff" /> : null}
            </Pressable>
          ))}
        </View>
        <View style={{ gap: 8 }}>
          <FormLabel>HEX</FormLabel>
          <Input
            value={draft}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={9}
            placeholder="#dc2626"
            onChangeText={(text) => {
              setDraft(text);
              commit(text);
            }}
          />
        </View>
      </FormModal>
    </>
  );
}

const useStyles = createStyles(({ colors, radius }) => ({
  swatch: {
    alignSelf: 'stretch',
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
  },
  preview: {
    height: 72,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.border,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  preset: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
}));
