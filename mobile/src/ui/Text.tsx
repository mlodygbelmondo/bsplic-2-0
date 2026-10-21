import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { fauxItalic, text, useTheme, type Colors } from '@/theme';

export interface TextProps extends RNTextProps {
  /** Tailwind text size (`text-sm` → `sm`). Default `sm`. */
  size?: keyof typeof text;
  weight?: TextStyle['fontWeight'];
  /** Theme color token, default `foreground`. */
  color?: keyof Colors;
  align?: TextStyle['textAlign'];
  italic?: boolean;
  /** Tabular numerals for money, odds and counters. */
  tabular?: boolean;
}

/** Inter text with theme colors. Caps font scaling so Dynamic Type never breaks layouts. */
export function Text({
  size = 'sm',
  weight,
  color = 'foreground',
  align,
  italic,
  tabular,
  style,
  maxFontSizeMultiplier = 1.35,
  ...props
}: TextProps) {
  const { colors } = useTheme();
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        text[size],
        { color: colors[color] },
        weight !== undefined && { fontWeight: weight },
        align !== undefined && { textAlign: align },
        italic && fauxItalic,
        tabular && { fontVariant: ['tabular-nums'] },
        style,
      ]}
      {...props}
    />
  );
}
