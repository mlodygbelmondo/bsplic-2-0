import { Outlet } from 'react-router-dom';
import { LoginPage } from '@/components/LoginPage';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';

export default function CasinoLayout() {
  const { user, profile, loading } = useAuth();

  // Show spinner while auth is loading, OR while we have a user but the
  // profile hasn't been fetched yet (avoids flashing the login page).
  if (loading || (user && !profile)) {
    return (
      <div className="min-safe-screen gradient-primary flex items-center justify-center">
        <div className="h-10 w-10 border-4 border-primary-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !profile) {
    return <LoginPage />;
  }

  return (
    <div className="h-safe-screen w-full max-w-full flex flex-col overflow-hidden casino-page-bg">
      <Navbar />
      <main className="min-w-0 flex-1 min-h-0 overflow-x-hidden overflow-y-auto">
        <Outlet context={{ user, profile }} />
      </main>
    </div>
  );
}
