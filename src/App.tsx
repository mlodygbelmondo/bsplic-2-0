import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { CouponProvider } from "@/contexts/CouponContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ProfilePage from "./pages/ProfilePage";
import RankingsPage from "./pages/RankingsPage";
import SocialPage from "./pages/SocialPage";
import AdminPage from "./pages/AdminPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

import CasinoLayout from "./pages/CasinoLayout";
import CasinoHub from "./pages/CasinoHub";
import CasinoRoulettePage from "./pages/CasinoRoulettePage";
import CasinoBlackjackPage from "./pages/CasinoBlackjackPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner position="top-right" richColors />
      <BrowserRouter>
        <AuthProvider>
          <CouponProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/profile/:userId" element={<ProfilePage />} />
              <Route path="/rankings" element={<RankingsPage />} />
              <Route path="/social" element={<SocialPage />} />

              <Route path="/casino" element={<CasinoLayout />}>
                <Route index element={<CasinoHub />} />
                <Route path="roulette" element={<CasinoRoulettePage />} />
                <Route path="blackjack" element={<CasinoBlackjackPage />} />
              </Route>

              <Route path="/admin" element={<AdminPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </CouponProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
