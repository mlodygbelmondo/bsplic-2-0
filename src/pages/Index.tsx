import { lazy, Suspense } from 'react';
import { BrandedLoader } from '@/components/BrandedLoader';
import { LoginPage } from '@/components/LoginPage';
import { useAuth } from '@/contexts/AuthContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { loadAuthenticatedHome } from '@/lib/boot/route-modules';

const AuthenticatedHome = lazy(loadAuthenticatedHome);

function HomeLoadingFallback() {
  return <BrandedLoader />;
}

const Index = () => {
  const { user, loading } = useAuth();
  usePageTitle('Zakłady');

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
