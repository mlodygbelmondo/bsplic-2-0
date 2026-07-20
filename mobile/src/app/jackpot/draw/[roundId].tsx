import { useLocalSearchParams } from 'expo-router';
import { JackpotDrawScreen } from '@/features/jackpot/components/jackpot-draw-screen';
export default function JackpotDrawRoute() { const { roundId } = useLocalSearchParams<{ roundId: string }>(); return <JackpotDrawScreen roundId={roundId} />; }
