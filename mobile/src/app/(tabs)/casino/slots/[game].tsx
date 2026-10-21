import { useLocalSearchParams } from 'expo-router';

import { SlotsScreen } from '@/features/slots/SlotsScreen';

export default function Screen() {
  const { game } = useLocalSearchParams<{ game: string }>();
  return <SlotsScreen game={game} />;
}
