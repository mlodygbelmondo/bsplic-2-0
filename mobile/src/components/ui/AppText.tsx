import { Text, type TextProps, type TextStyle } from 'react-native';

import { useAppTheme } from '@/hooks/use-app-theme';

export type AppTextVariant = 'body' | 'caption' | 'label' | 'subtitle' | 'title' | 'display';
export type AppTextTone = 'default' | 'muted' | 'primary' | 'danger' | 'success' | 'inverse';

export interface AppTextProps extends TextProps {
  variant?: AppTextVariant;
  tone?: AppTextTone;
}

const variantStyles: Record<AppTextVariant, TextStyle> = {
  body: { fontSize: 16, lineHeight: 24 },
  caption: { fontSize: 12, lineHeight: 16 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  subtitle: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800' },
  display: { fontSize: 32, lineHeight: 38, fontWeight: '900' },
};

export function AppText({ variant = 'body', tone = 'default', style, ...props }: AppTextProps) {
  const { tokens } = useAppTheme();
  const toneColors: Record<AppTextTone, string> = {
    default: tokens.colors.foreground,
    muted: tokens.colors.mutedForeground,
    primary: tokens.colors.primary,
    danger: tokens.colors.destructive,
    success: tokens.colors.success,
    inverse: tokens.colors.primaryForeground,
  };

  return <Text {...props} style={[variantStyles[variant], { color: toneColors[tone] }, style]} />;
}
