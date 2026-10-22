import { Stack } from 'expo-router';

// A deep link to a game opens on top of the hub.
export const unstable_settings = { anchor: 'index' };

export default function Layout() {
  // One copy of each game even on a double tap (the tables share module-level state).
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="roulette" dangerouslySingular />
      <Stack.Screen name="blackjack" dangerouslySingular />
      <Stack.Screen name="slots/[game]" dangerouslySingular />
    </Stack>
  );
}
