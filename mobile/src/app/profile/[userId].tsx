import { useLocalSearchParams } from 'expo-router';
import { ProfileScreen } from '@/features/profile/components/profile-screen';

export default function PublicProfileRoute() { const { userId } = useLocalSearchParams<{ userId: string }>(); return <ProfileScreen userRef={userId} />; }
