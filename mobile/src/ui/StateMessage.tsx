import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Button } from './Button';
import { Text } from './Text';

export interface StateMessageProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Empty / error / offline block: icon, title, optional description and action. */
export function StateMessage({ icon, title, description, actionLabel, onAction }: StateMessageProps) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24, gap: 8 }}>
      {icon}
      <Text size="base" weight="700" align="center">
        {title}
      </Text>
      {description ? (
        <Text color="mutedForeground" align="center">
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button variant="outline" size="sm" label={actionLabel} onPress={onAction} style={{ marginTop: 8 }} />
      ) : null}
    </View>
  );
}
