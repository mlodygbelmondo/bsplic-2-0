import { Easing, withTiming, type EntryExitAnimationFunction } from 'react-native-reanimated';

/** framer-motion panel entrances on the web table. */
const ENTER = { duration: 300, easing: Easing.out(Easing.cubic) };
const EXIT = { duration: 200, easing: Easing.in(Easing.cubic) };

/** `initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}` */
export const enterUp: EntryExitAnimationFunction = () => {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ translateY: 20 }] },
    animations: { opacity: withTiming(1, ENTER), transform: [{ translateY: withTiming(0, ENTER) }] },
  };
};

/** `initial={{ opacity: 0, y: 8 }}` for the result lines. */
export const enterUpSmall: EntryExitAnimationFunction = () => {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ translateY: 8 }] },
    animations: { opacity: withTiming(1, ENTER), transform: [{ translateY: withTiming(0, ENTER) }] },
  };
};

/** Loading pill: `initial={{ opacity: 0, y: 10 }}`. */
export const enterUpLoading: EntryExitAnimationFunction = () => {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ translateY: 10 }] },
    animations: { opacity: withTiming(1, ENTER), transform: [{ translateY: withTiming(0, ENTER) }] },
  };
};

/** Result panel: `initial={{ opacity: 0, scale: 0.9 }}`. */
export const enterScale: EntryExitAnimationFunction = () => {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.9 }] },
    animations: { opacity: withTiming(1, ENTER), transform: [{ scale: withTiming(1, ENTER) }] },
  };
};

/** Betting panel: `exit={{ opacity: 0, y: -20 }}`. */
export const exitUp: EntryExitAnimationFunction = () => {
  'worklet';
  return {
    initialValues: { opacity: 1, transform: [{ translateY: 0 }] },
    animations: { opacity: withTiming(0, EXIT), transform: [{ translateY: withTiming(-20, EXIT) }] },
  };
};

/** `initial={{ opacity: 0 }} animate={{ opacity: 1 }}` for the dealer area and hands. */
export const fadeIn: EntryExitAnimationFunction = () => {
  'worklet';
  return {
    initialValues: { opacity: 0 },
    animations: { opacity: withTiming(1, ENTER) },
  };
};
