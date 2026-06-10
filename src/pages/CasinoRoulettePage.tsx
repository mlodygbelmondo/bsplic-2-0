import { CasinoLobby } from '@/features/casino/components/CasinoLobby';
import { useAuth } from '@/contexts/AuthContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import type { CSSProperties } from 'react';

type CasinoBackgroundStyle = CSSProperties & {
  '--casino-bg-desktop': string;
  '--casino-bg-mobile': string;
};

export default function CasinoRoulettePage() {
  usePageTitle('Ruletka');
  const { user, profile, refreshProfile } = useAuth();

  if (!user || !profile) return null;

  return (
    <div
      data-testid="casino-roulette-shell"
      className="casino-responsive-bg relative min-h-full w-full overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{
        '--casino-bg-desktop': "url('/casino/roulette-background.webp')",
        '--casino-bg-mobile': "url('/casino/roulette-mobile-background.webp')",
      } as CasinoBackgroundStyle}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.14),transparent_35%),linear-gradient(180deg,rgba(8,4,6,0.52),rgba(5,4,7,0.84)_55%,rgba(5,4,7,0.96))]" />
      <div className="relative z-10 mx-auto w-full max-w-[1800px] p-4 pb-10 pt-6 md:p-6 md:pb-14">
        <CasinoLobby
          userId={user.id}
          username={profile.username}
          avatarUrl={profile.avatar_url ?? null}
          balance={Number(profile.balance)}
          refreshProfile={refreshProfile}
        />
      </div>
    </div>
  );
}
