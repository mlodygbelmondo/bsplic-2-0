import * as Battery from 'expo-battery';
import { useEffect, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

/** iOS Low Power Mode / Android battery saver (web: `html.perf-lite`). */
export function useLowPowerMode(): boolean {
  const [lowPower, setLowPower] = useState(false);
  useEffect(() => {
    let active = true;
    Battery.isLowPowerModeEnabledAsync()
      .then((enabled) => active && setLowPower(enabled))
      .catch(() => undefined);
    const subscription = Battery.addLowPowerModeListener(({ lowPowerMode }) => setLowPower(lowPowerMode));
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return lowPower;
}

/**
 * True when decorative infinite animations and heavy glass/blur must stop:
 * the user prefers reduced motion or the device is in Low Power Mode.
 */
export function useLiteMotion(): boolean {
  const reduced = useReducedMotion();
  const lowPower = useLowPowerMode();
  return reduced || lowPower;
}

export { useReducedMotion };
