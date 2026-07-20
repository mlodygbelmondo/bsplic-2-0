import { useLocalSearchParams } from 'expo-router';
import { SocialItemScreen } from '@/features/social';
import type { FeedItemType } from '@/types/database';
export default function SocialItemRoute() { const { itemType, itemId } = useLocalSearchParams<{ itemType: FeedItemType; itemId: string }>(); return <SocialItemScreen itemType={itemType} itemId={itemId} />; }
