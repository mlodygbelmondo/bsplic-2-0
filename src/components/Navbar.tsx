import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useLocation } from "react-router-dom";
import { LogOut, ShieldCheck, Plus, Wallet, Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { canClaimTopup } from "@/features/social/polishDay";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function Navbar() {
  const { user, profile, isAdmin, signOut, refreshProfile } = useAuth();
  const location = useLocation();
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupLoading, setTopupLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActivePath = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return (
      location.pathname === path || location.pathname.startsWith(`${path}/`)
    );
  };

  const canTopup = () => canClaimTopup(profile?.last_topup_at);

  const handleTopup = async () => {
    if (!user || !profile) return;
    setTopupLoading(true);
    try {
      const { error } = await supabase.rpc("secure_daily_topup", {
        p_user_id: user.id,
      });
      if (error) {
        toast.error(error.message || "Błąd doładowania");
        return;
      }
      await refreshProfile();
      toast.success("💰 Doładowano 100 zł. Wróć jutro po więcej!");
      setTopupOpen(false);
    } catch {
      toast.error("Błąd doładowania");
    } finally {
      setTopupLoading(false);
    }
  };

  const navLinks = [
    { to: "/", label: "Zakłady sportowe" },
    { to: "/social", label: "Social" },
    { to: "/rankings", label: "Rankingi" },
  ];

  if (isAdmin) {
    navLinks.push({ to: "/admin", label: "Admin" });
  }

  return (
    <>
      <nav className="gradient-navbar safe-sticky-top sticky top-0 z-50 shadow-md">
        <div className="flex items-center justify-between px-4 h-11 max-w-[1600px] mx-auto">
          {/* Left */}
          <div className="flex items-center gap-5">
            <Link
              to="/"
              className="text-[15px] font-black text-primary-foreground tracking-tight hover:brightness-110 transition"
            >
              BSPLIC 2.0
            </Link>
            <div className="hidden lg:flex items-center gap-4">
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
                to="/social"
                className={cn(
                  "text-[13px] font-semibold hover:text-primary-foreground transition-colors",
                  isActivePath("/social")
                    ? "text-primary-foreground"
                    : "text-primary-foreground/70",
                )}
              >
                Social
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

          <div className="hidden lg:flex items-center gap-2">
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
                {Number(profile.balance).toFixed(2)} zł
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

          <div className="lg:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Otwórz menu"
                  className="text-primary-foreground/90 flex items-center hover:text-primary-foreground transition-colors"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="safe-area-top duration-100 safe-area-bottom w-[86vw] max-w-sm p-0 border-l border-border"
              >
                <div className="flex h-full flex-col">
                  <div className="border-b border-border px-4 py-4">
                    <SheetHeader className="text-left space-y-1">
                      <SheetTitle className="text-base">Menu</SheetTitle>
                    </SheetHeader>
                  </div>

                  <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
                    <div className="space-y-1.5">
                      {navLinks.map((link) => (
                        <SheetClose asChild key={link.to}>
                          <Link
                            to={link.to}
                            className={cn(
                              "block rounded-md px-3 py-2.5 text-sm font-semibold transition-colors",
                              isActivePath(link.to)
                                ? "bg-primary/10 text-primary"
                                : "text-foreground hover:bg-muted",
                            )}
                          >
                            {link.label}
                          </Link>
                        </SheetClose>
                      ))}
                    </div>

                    {profile && (
                      <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Saldo</span>
                          <span className="font-bold text-foreground">
                            {Number(profile.balance).toFixed(2)} zł
                          </span>
                        </div>

                        <button
                          onClick={() => {
                            if (!canTopup()) {
                              toast.error(
                                "Już doładowano dzisiaj. Wróć jutro!",
                              );
                              return;
                            }
                            setMobileMenuOpen(false);
                            setTopupOpen(true);
                          }}
                          className="w-full flex items-center justify-center gap-1 bg-primary/10 hover:bg-primary/15 text-primary px-3 py-2 rounded-md text-[12px] font-bold transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Doładuj 100 zł
                        </button>

                        <SheetClose asChild>
                          <Link
                            to="/profile"
                            className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-background transition-colors"
                          >
                            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary">
                              {profile.username.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm font-medium text-foreground">
                              {profile.username}
                            </span>
                          </Link>
                        </SheetClose>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border p-4">
                    <SheetClose asChild>
                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          signOut();
                        }}
                        className="w-full flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        Wyloguj się
                      </button>
                    </SheetClose>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>

      {/* Topup confirmation modal */}
      <Dialog open={topupOpen} onOpenChange={setTopupOpen}>
        <DialogContent className="w-[calc(100%-1.25rem)] max-w-sm rounded-xl p-5 sm:w-full sm:max-w-sm">
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
