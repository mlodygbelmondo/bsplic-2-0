import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { LoginPage } from '@/components/LoginPage';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';

export default function CasinoLayout() {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-safe-screen gradient-primary flex items-center justify-center">
        <div className="h-10 w-10 border-4 border-primary-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !profile) {
    // We render LoginPage directly on the /casino route if not logged in
    return <LoginPage />;
  }

  // If we are exactly on /casino, we let the index route handle it
  // But we provide the layout for all nested routes too

  return (
    <div className="h-safe-screen w-full max-w-full flex flex-col overflow-hidden casino-page-bg">
      <Navbar />
      <main className="min-w-0 flex-1 min-h-0 overflow-x-hidden overflow-y-auto">
        <Outlet context={{ user, profile }} />
      </main>
    </div>
  );
}
