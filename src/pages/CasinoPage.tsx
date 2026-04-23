import { LoginPage } from '@/components/LoginPage';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { CasinoLobby } from '@/features/casino/components/CasinoLobby';

export default function CasinoPage() {
  const { user, profile, loading, refreshProfile } = useAuth();

  if (loading) {
    return (
      <div className="min-safe-screen gradient-primary flex items-center justify-center">
        <div className="h-10 w-10 border-4 border-primary-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  if (!profile) {
    return (
      <div className="min-safe-screen gradient-primary flex items-center justify-center">
        <div className="h-10 w-10 border-4 border-primary-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden casino-page-bg">
      <Navbar />
      <main className="mx-auto max-w-7xl p-4 pb-10 pt-6 md:p-6 md:pb-14">
        <CasinoLobby
          userId={user.id}
          balance={Number(profile.balance)}
          refreshProfile={refreshProfile}
        />
      </main>
    </div>
  );
}
