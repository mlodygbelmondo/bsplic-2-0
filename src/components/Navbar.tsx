import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCoupon } from "@/contexts/CouponContext";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut, User, ShieldCheck, Plus, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Navbar() {
  const { user, profile, isAdmin, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupLoading, setTopupLoading] = useState(false);

  const isActivePath = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return (
      location.pathname === path || location.pathname.startsWith(`${path}/`)
    );
  };

  const canTopup = () => {
    if (!profile?.last_topup_at) return true;
    const last = new Date(profile.last_topup_at).getTime();
    return Date.now() - last >= 24 * 60 * 60 * 1000;
  };

  const handleTopup = async () => {
    if (!user || !profile) return;
    if (!canTopup()) {
      toast.error("Już doładowano dzisiaj. Wróć jutro!");
      return;
    }
    setTopupLoading(true);
    try {
      await supabase
        .from("profiles")
        .update({
          balance: Number(profile.balance) + 100,
          last_topup_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      await refreshProfile();
      toast.success("💰 Doładowano 100 zł. Wróć jutro po więcej!");
      setTopupOpen(false);
    } catch {
      toast.error("Błąd doładowania");
    } finally {
      setTopupLoading(false);
    }
  };

  return (
    <>
      <nav className="gradient-navbar sticky top-0 z-50 shadow-md">
        <div className="flex items-center justify-between px-4 h-11 max-w-[1600px] mx-auto">
          {/* Left */}
          <div className="flex items-center gap-5">
            <Link
              to="/"
              className="text-[15px] font-black text-primary-foreground tracking-tight hover:brightness-110 transition"
            >
              BSPLIC 2.0
            </Link>
            <div className="hidden md:flex items-center gap-4">
              <Link
                to="/"
                className={cn(
                  "text-[13px] font-semibold hover:text-primary-foreground hover:brightness-110 transition-colors",
                  isActivePath("/")
                    ? "text-primary-foreground"
                    : "text-primary-foreground/70",
                )}
              >
                Zakłady sportowe
              </Link>
              <Link
                to="/rankings"
                className={cn(
                  "text-[13px] font-semibold hover:text-primary-foreground transition-colors",
                  isActivePath("/rankings")
                    ? "text-primary-foreground"
                    : "text-primary-foreground/70",
                )}
              >
                Rankingi
              </Link>
              {isAdmin && (
                <Link
                  to="/admin"
                  className={cn(
                    "text-[13px] font-semibold hover:text-primary-foreground transition-colors flex items-center gap-1",
                    isActivePath("/admin")
                      ? "text-primary-foreground"
                      : "text-primary-foreground/70",
                  )}
                >
                  <ShieldCheck className="h-3.5 w-3.5" /> Admin
                </Link>
              )}
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            {profile && (
              <button
                onClick={() =>
                  canTopup()
                    ? setTopupOpen(true)
                    : toast.error("Już doładowano dzisiaj. Wróć jutro!")
                }
                className="flex items-center gap-1 bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground px-2.5 py-1 rounded-full text-[12px] font-bold transition-colors"
                title={
                  canTopup()
                    ? "Doładuj portfel"
                    : "Już doładowano dzisiaj. Wróć jutro!"
                }
              >
                <Wallet className="h-3 w-3" />
                {Number(profile.balance).toFixed(0)} zł
              </button>
            )}
            {profile && (
              <Link
                to="/profile"
                className="flex items-center gap-1.5 text-primary-foreground text-[12px] font-medium hover:brightness-110 transition"
              >
                <div className="h-6 w-6 rounded-full bg-primary-foreground/20 flex items-center justify-center text-[10px] font-bold text-primary-foreground">
                  {profile.username.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:inline">{profile.username}</span>
              </Link>
            )}
            <button
              onClick={() => signOut()}
              className="text-primary-foreground/60 hover:text-primary-foreground transition-colors ml-1"
              title="Wyloguj"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Topup confirmation modal */}
      <Dialog open={topupOpen} onOpenChange={setTopupOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">
              💰 Doładuj portfel
            </DialogTitle>
          </DialogHeader>
          <div className="text-center space-y-4 py-2">
            <p className="text-muted-foreground text-sm">
              Doładuj swój portfel o{" "}
              <span className="font-bold text-foreground">100 zł</span>. Możesz
              to zrobić raz dziennie.
            </p>
            <Button
              onClick={handleTopup}
              disabled={topupLoading}
              className="w-full gradient-primary text-primary-foreground font-bold h-11"
            >
              {topupLoading ? "Ładowanie..." : "Doładuj 100 zł"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
