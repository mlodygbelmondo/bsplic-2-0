import { Image, StyleSheet, View, type ImageSourcePropType, type ViewProps } from 'react-native';

import { useAppTheme } from '@/hooks/use-app-theme';

import { AppText } from './AppText';

export interface AppAvatarProps extends ViewProps {
  source?: ImageSourcePropType;
  name: string;
  size?: number;
}

export function AppAvatar({ source, name, size = 36, style, ...props }: AppAvatarProps) {
  const { tokens } = useAppTheme();
  const initial = name.trim().charAt(0).toLocaleUpperCase('pl-PL') || '?';

  return (
    <View
      {...props}
      accessibilityRole="image"
      accessibilityLabel={`Avatar ${name}`}
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: `${tokens.colors.primary}22` },
        style,
      ]}
    >
      {source ? (
        <Image source={source} style={{ width: size, height: size }} resizeMode="cover" />
      ) : (
        <AppText tone="primary" style={{ fontSize: size * 0.38, fontWeight: '800' }}>
          {initial}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({ avatar: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' } });
