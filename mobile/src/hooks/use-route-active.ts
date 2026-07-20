import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

export function useRouteActive(): boolean {
  const [active, setActive] = useState(false);

  useFocusEffect(useCallback(() => {
    setActive(true);
    return () => setActive(false);
  }, []));

  return active;
}
