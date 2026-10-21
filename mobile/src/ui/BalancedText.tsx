import { useState } from 'react';
import { Text, type TextLayoutEvent, type TextProps } from 'react-native';

import { balancedSplit } from './balanced-split';

interface BalancedTextProps extends Omit<TextProps, 'children'> {
  children: string;
}

/**
 * CSS `text-wrap: balance` for short headings: when the text wraps to two
 * lines, the break moves to where both lines come out even. If the estimate
 * overflows into a third line, the original wrapping comes back.
 */
export function BalancedText({ children, onTextLayout, ...props }: BalancedTextProps) {
  const [balanced, setBalanced] = useState<{ source: string; text: string } | null>(null);
  const text = balanced?.source === children ? balanced.text : null;

  const handleTextLayout = (event: TextLayoutEvent) => {
    onTextLayout?.(event);
    const { lines } = event.nativeEvent;
    if (text === null) {
      if (lines.length !== 2) return;
      const split = balancedSplit(children, lines[0], lines[1]);
      if (split) setBalanced({ source: children, text: split });
    } else if (lines.length > 2 && text !== children) {
      setBalanced({ source: children, text: children });
    }
  };

  return (
    <Text {...props} onTextLayout={handleTextLayout}>
      {text ?? children}
    </Text>
  );
}
