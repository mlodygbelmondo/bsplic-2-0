import { lazy, Suspense } from 'react';
import { LoginPage } from '@/components/LoginPage';
import { useAuth } from '@/contexts/AuthContext';

const AuthenticatedHome = lazy(
  () => import('@/features/home/components/AuthenticatedHome'),
);

function HomeLoadingFallback() {
  return (
    <div className="min-safe-screen gradient-primary flex items-center justify-center">
      <div className="h-10 w-10 border-4 border-primary-foreground border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <HomeLoadingFallback />;
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <Suspense fallback={<HomeLoadingFallback />}>
      <AuthenticatedHome />
    </Suspense>
  );
};

export default Index;
