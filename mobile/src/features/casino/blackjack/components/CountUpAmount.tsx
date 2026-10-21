import { useEffect } from 'react';
import { TextInput, type StyleProp, type TextStyle } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from '@/lib/motion';
import { createStyles, fonts } from '@/theme';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const format = (value: number, prefix: string) => {
  'worklet';
  return `${prefix}${value.toFixed(2)} zł`;
};

/**
 * Payout counter for the result screen (web `CountUpAmount`): counts from 0
 * with a 900 ms cubic ease-out. The text updates on the UI thread through a
 * read-only TextInput, so the JS thread does no per-frame work.
 */
export function CountUpAmount({
  value,
  prefix = '',
  style,
}: {
  value: number;
  prefix?: string;
  style?: StyleProp<TextStyle>;
}) {
  const styles = useStyles();
  const reducedMotion = useReducedMotion();
  const display = useSharedValue(reducedMotion ? value : 0);

  useEffect(() => {
    display.set(reducedMotion ? value : withTiming(value, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [display, value, reducedMotion]);

  const animatedProps = useAnimatedProps(() => {
    const text = format(display.get(), prefix);
    return { text, defaultValue: text };
  });

  return (
    <AnimatedTextInput
      testID="blackjack-payout-countup"
      accessibilityLabel={format(value, prefix)}
      editable={false}
      pointerEvents="none"
      underlineColorAndroid="transparent"
      maxFontSizeMultiplier={1.35}
      defaultValue={format(reducedMotion ? value : 0, prefix)}
      animatedProps={animatedProps}
      style={[styles.text, style]}
    />
  );
}

const useStyles = createStyles(() => ({
  text: { padding: 0, margin: 0, fontFamily: fonts.family },
}));
