import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CouponProvider } from "@/contexts/CouponContext";
import Index from "./pages/Index";

const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const RankingsPage = lazy(() => import("./pages/RankingsPage"));
const SocialPage = lazy(() => import("./pages/SocialPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const CasinoLayout = lazy(() => import("./pages/CasinoLayout"));
const CasinoHub = lazy(() => import("./pages/CasinoHub"));
const CasinoRoulettePage = lazy(() => import("./pages/CasinoRoulettePage"));
const CasinoRouletteDevPage = lazy(
  () => import("./pages/CasinoRouletteDevPage"),
);
const CasinoBlackjackPage = lazy(() => import("./pages/CasinoBlackjackPage"));
const BonusCampaignSurface = lazy(() =>
  import("@/features/bonus-campaigns/components/bonus-campaign-surface").then(
    (module) => ({ default: module.BonusCampaignSurface }),
  ),
);

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
  return (
    <div className="min-safe-screen gradient-primary flex items-center justify-center">
      <div className="h-10 w-10 border-4 border-primary-foreground border-t-transparent rounded-full animate-spin" />
    </div>
  );
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner position="top-right" richColors />
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

                <Route path="/casino" element={<CasinoLayout />}>
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
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
