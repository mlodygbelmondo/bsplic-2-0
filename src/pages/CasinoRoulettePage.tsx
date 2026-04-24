import { useOutletContext } from 'react-router-dom';
import { CasinoLobby } from '@/features/casino/components/CasinoLobby';
import { useAuth } from '@/contexts/AuthContext';

export default function CasinoRoulettePage() {
  const { user, profile, refreshProfile } = useAuth();

  if (!user || !profile) return null;

  return (
    <div className="mx-auto w-full max-w-7xl p-4 pb-10 pt-6 md:p-6 md:pb-14">
      <CasinoLobby
        userId={user.id}
        balance={Number(profile.balance)}
        refreshProfile={refreshProfile}
      />
    </div>
  );
}
