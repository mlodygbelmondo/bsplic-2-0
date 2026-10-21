import { useLocalSearchParams } from 'expo-router';

import { SlotRulesSheet } from '@/features/slots/SlotRulesSheet';

export default function Screen() {
  const { game } = useLocalSearchParams<{ game: string }>();
  return <SlotRulesSheet game={game} />;
}
