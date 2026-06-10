import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { toast } from "sonner";
import { BrandedLoader } from "@/components/BrandedLoader";
import { LoginPage } from "@/components/LoginPage";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CouponProvider } from "@/contexts/CouponContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Index from "./pages/Index";

const loadProfilePage = () => import("./pages/ProfilePage");
const loadRankingsPage = () => import("./pages/RankingsPage");
const loadSocialPage = () => import("./pages/SocialPage");
const loadSocialItemPage = () => import("./pages/SocialItemPage");
const loadAdminPage = () => import("./pages/AdminPage");
const loadResetPasswordPage = () => import("./pages/ResetPasswordPage");
const loadNotFound = () => import("./pages/NotFound");
const loadCasinoLayout = () => import("./pages/CasinoLayout");
const loadCasinoHub = () => import("./pages/CasinoHub");
const loadCasinoRoulettePage = () => import("./pages/CasinoRoulettePage");
const loadCasinoBlackjackPage = () => import("./pages/CasinoBlackjackPage");

const ProfilePage = lazy(loadProfilePage);
const RankingsPage = lazy(loadRankingsPage);
const SocialPage = lazy(loadSocialPage);
const SocialItemPage = lazy(loadSocialItemPage);
const AdminPage = lazy(loadAdminPage);
const ResetPasswordPage = lazy(loadResetPasswordPage);
const NotFound = lazy(loadNotFound);
const CasinoLayout = lazy(loadCasinoLayout);
const CasinoHub = lazy(loadCasinoHub);
const CasinoRoulettePage = lazy(loadCasinoRoulettePage);
const CasinoRouletteDevPage = lazy(
  () => import("./pages/CasinoRouletteDevPage"),
);
const CasinoBlackjackPage = lazy(loadCasinoBlackjackPage);
const BonusCampaignSurface = lazy(() =>
  import("@/features/bonus-campaigns/components/bonus-campaign-surface").then(
    (module) => ({ default: module.BonusCampaignSurface }),
  ),
);

// Warm the lazy route chunks during idle time so in-app navigation
// doesn't flash the full-screen loader on every page change.
const PREFETCH_PAGE_LOADERS = [
  loadSocialPage,
  loadRankingsPage,
  loadProfilePage,
  loadSocialItemPage,
  loadCasinoLayout,
  loadCasinoHub,
  loadCasinoRoulettePage,
  loadCasinoBlackjackPage,
  loadNotFound,
];

function RoutePrefetcher() {
  useEffect(() => {
    const prefetchRoutes = () => {
      PREFETCH_PAGE_LOADERS.forEach((load) => {
        void load().catch(() => {
          // Chunk fetch failed (offline, deploy in progress) — the route
          // will load on demand instead.
        });
      });
    };

    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(prefetchRoutes, {
        timeout: 5000,
      });
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = window.setTimeout(prefetchRoutes, 2500);
    return () => window.clearTimeout(timeoutId);
  }, []);

  return null;
}

function ConnectionToasts() {
  useEffect(() => {
    const handleOffline = () =>
      toast.error("Brak połączenia z internetem", {
        id: "connection-status",
        duration: Number.POSITIVE_INFINITY,
      });
    const handleOnline = () =>
      toast.success("Połączenie przywrócone", {
        id: "connection-status",
        duration: 3000,
      });

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

function AppLoadingFallback() {
  return <BrandedLoader />;
}

function AuthenticatedBonusCampaignSurface() {
  const { user, profile, loading } = useAuth();

  if (loading || !user || !profile) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <BonusCampaignSurface />
    </Suspense>
  );
}

function AuthenticatedRoute({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();

  if (loading || (user && !profile)) {
    return <AppLoadingFallback />;
  }

  if (!user || !profile) {
    return <LoginPage />;
  }

  return <>{children}</>;
}

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <Sonner richColors />
      <ConnectionToasts />
      <RoutePrefetcher />
      <BrowserRouter>
        <AuthProvider>
          <AuthenticatedBonusCampaignSurface />
          <CouponProvider>
            <Suspense fallback={<AppLoadingFallback />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/profile/:userId" element={<ProfilePage />} />
                <Route path="/rankings" element={<RankingsPage />} />
                <Route path="/social" element={<SocialPage />} />
                <Route
                  path="/social/:itemType/:itemId"
                  element={<SocialItemPage />}
                />

                <Route
                  path="/casino"
                  element={
                    <AuthenticatedRoute>
                      <CasinoLayout />
                    </AuthenticatedRoute>
                  }
                >
                  <Route index element={<CasinoHub />} />
                  <Route path="roulette" element={<CasinoRoulettePage />} />
                  <Route
                    path="roulette/dev"
                    element={<CasinoRouletteDevPage />}
                  />
                  <Route path="blackjack" element={<CasinoBlackjackPage />} />
                </Route>

                <Route path="/admin" element={<AdminPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </CouponProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
