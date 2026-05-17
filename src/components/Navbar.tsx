import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Dice5,
  House,
  LogOut,
  Menu,
  MessageCircle,
  Plus,
  ShieldCheck,
  Trophy,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';
import { NotificationsBell } from '@/features/notifications/components/NotificationsBell';
import { canClaimTopup } from '@/features/social/polishDay';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const menuLinks = [
  { to: '/', label: 'Zakłady' },
  { to: '/casino', label: 'Kasyno' },
  { to: '/social', label: 'Social' },
  { to: '/rankings', label: 'Rankingi' },
];

const userBottomTabs = [
  { to: '/', label: 'Sport', icon: House },
  { to: '/casino', label: 'Kasyno', icon: Dice5 },
  { to: '/social', label: 'Social', icon: MessageCircle },
  { to: '/rankings', label: 'Rankingi', icon: Trophy },
];

export function Navbar() {
  const { user, profile, isAdmin, signOut, refreshProfile } = useAuth();
  const location = useLocation();
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupLoading, setTopupLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdminRoute = location.pathname.startsWith('/admin');
  const shouldShowUserBottomNav = !isAdminRoute;

  const isActivePath = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return (
      location.pathname === path || location.pathname.startsWith(`${path}/`)
    );
  };

  const canTopup = () => canClaimTopup(profile?.last_topup_at);

  const handleTopup = async () => {
    if (!user || !profile) return;
    setTopupLoading(true);
    try {
      const { error } = await supabase.rpc('secure_daily_topup', {
        p_user_id: user.id,
      });
      if (error) {
        toast.error(error.message || 'Błąd doładowania');
        return;
      }
      await refreshProfile();
      toast.success('💰 Doładowano 100 zł. Wróć jutro po więcej!');
      setTopupOpen(false);
    } catch {
      toast.error('Błąd doładowania');
    } finally {
      setTopupLoading(false);
    }
  };

  const openTopup = () => {
    if (!canTopup()) {
      toast.error('Już doładowano dzisiaj. Wróć jutro!');
      return;
    }
    setMobileMenuOpen(false);
    setTopupOpen(true);
  };

  const navLinks = isAdmin
    ? [...menuLinks, { to: '/admin', label: 'Admin' }]
    : menuLinks;

  return (
    <>
      <nav className="app-topbar fixed inset-x-0 top-0 z-50 text-primary-foreground shadow-[0_8px_24px_rgba(0,0,0,0.24)]">
        <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between px-5">
          <div className="flex min-w-0 items-center gap-5">
            <Link
              to="/"
              className="text-[18px] font-black uppercase leading-none tracking-tight text-primary-foreground transition hover:brightness-110"
            >
              BSPLIC 2.0
            </Link>

            <div className="hidden items-center gap-5 lg:flex">
              {menuLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={cn(
                    'text-[14px] font-bold leading-none transition-colors hover:text-primary-foreground',
                    isActivePath(link.to)
                      ? 'text-primary-foreground'
                      : 'text-primary-foreground/70',
                  )}
                >
                  {link.label}
                </Link>
              ))}
              {isAdmin && (
                <Link
                  to="/admin"
                  className={cn(
                    'inline-flex items-center gap-1.5 text-[14px] font-bold leading-none transition-colors hover:text-primary-foreground',
                    isActivePath('/admin')
                      ? 'text-primary-foreground'
                      : 'text-primary-foreground/70',
                  )}
                >
                  <ShieldCheck className="h-4 w-4 shrink-0" /> Admin
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 lg:flex">
              {profile && (
                <button
                  onClick={openTopup}
                  className="flex h-8 items-center gap-1 rounded-full bg-white/16 px-3 text-[12px] font-extrabold text-primary-foreground ring-1 ring-white/18 transition hover:bg-white/24"
                  title={
                    canTopup()
                      ? 'Doładuj portfel'
                      : 'Już doładowano dzisiaj. Wróć jutro!'
                  }
                >
                  <Wallet className="h-3.5 w-3.5" />
                  {Number(profile.balance).toFixed(2)} zł
                </button>
              )}
              {profile && (
                <Link
                  to="/profile"
                  className="flex items-center gap-1.5 rounded-full bg-black/12 px-1.5 py-1 text-primary-foreground transition hover:bg-black/20"
                >
                  <Avatar className="h-7 w-7 bg-white/20">
                    <AvatarImage
                      src={profile.avatar_url ?? undefined}
                      alt={`Avatar ${profile.username}`}
                    />
                    <AvatarFallback className="bg-white/20 text-[10px] font-black text-primary-foreground">
                      {profile.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="max-w-28 truncate pr-1 text-[12px] font-bold">
                    {profile.username}
                  </span>
                </Link>
              )}
            </div>

            <NotificationsBell
              userId={user?.id}
              className="h-10 w-10 text-primary-foreground/90 hover:text-primary-foreground [&>svg]:h-5 [&>svg]:w-5"
            />

            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Otwórz menu"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-primary-foreground/90 transition hover:bg-white/12 hover:text-primary-foreground"
                >
                  <Menu className="h-7 w-7" />
                </button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="safe-area-top safe-area-bottom w-[86vw] max-w-sm border-l border-white/10 bg-[#11141f] p-0 text-white duration-150"
              >
                <div className="flex h-full min-h-0 flex-col">
                  <div className="border-b border-white/10 px-5 py-5">
                    <SheetHeader className="space-y-1 text-left">
                      <SheetTitle className="text-base font-black uppercase tracking-tight text-white">
                        Menu
                      </SheetTitle>
                    </SheetHeader>
                  </div>

                  <div className="flex-1 overflow-y-auto px-4 py-4">
                    <div className="space-y-5">
                      <MenuSection title="Sekcje">
                        {navLinks.map((link) => (
                          <SheetClose asChild key={link.to}>
                            <Link
                              to={link.to}
                              className={cn(
                                'flex min-h-12 items-center rounded-xl px-4 text-[15px] font-extrabold transition-colors',
                                isActivePath(link.to)
                                  ? 'bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(225,0,26,0.28)]'
                                  : 'bg-white/[0.04] text-white/86 hover:bg-white/[0.08] hover:text-white',
                              )}
                            >
                              {link.label}
                            </Link>
                          </SheetClose>
                        ))}
                      </MenuSection>

                      {profile && (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.2)]">
                          <div className="mb-3 flex items-center justify-between text-sm">
                            <span className="font-semibold text-white/58">
                              Saldo
                            </span>
                            <span className="font-black text-white">
                              {Number(profile.balance).toFixed(2)} zł
                            </span>
                          </div>

                          <button
                            onClick={openTopup}
                            className="mb-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white/10 text-sm font-black text-white transition hover:bg-white/14"
                          >
                            <Plus className="h-4 w-4 text-[#ffd83f]" />
                            Doładuj 100 zł
                          </button>

                          <SheetClose asChild>
                            <Link
                              to="/profile"
                              className="flex min-h-12 items-center gap-3 rounded-xl bg-black/16 px-3 transition hover:bg-black/24"
                            >
                              <Avatar className="h-9 w-9 bg-white/10">
                                <AvatarImage
                                  src={profile.avatar_url ?? undefined}
                                  alt={`Avatar ${profile.username}`}
                                />
                                <AvatarFallback className="bg-white/10 text-[12px] font-black text-white">
                                  {profile.username.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-black text-white">
                                  {profile.username}
                                </p>
                                <p className="text-[11px] font-semibold text-white/50">
                                  Profil gracza
                                </p>
                              </div>
                            </Link>
                          </SheetClose>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-white/10 p-4">
                    <SheetClose asChild>
                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          signOut();
                        }}
                        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] text-sm font-black text-white/82 transition hover:bg-white/[0.07] hover:text-white"
                      >
                        <LogOut className="h-4 w-4" />
                        Wyloguj się
                      </button>
                    </SheetClose>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <button
              onClick={() => signOut()}
              className="hidden h-8 w-8 items-center justify-center rounded-full text-primary-foreground/70 transition hover:bg-white/12 hover:text-primary-foreground lg:flex"
              title="Wyloguj"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </nav>

      <div className="navbar-offset" aria-hidden="true" />

      {shouldShowUserBottomNav && (
        <nav
          className="app-mobile-bottom-nav fixed inset-x-0 bottom-0 z-50 lg:hidden"
          aria-label="Nawigacja główna"
        >
          <div className="mx-auto grid max-w-xl grid-cols-5 border-t border-white/10 bg-[#10131e] px-2 pt-2 shadow-[0_-18px_40px_rgba(0,0,0,0.4)] backdrop-blur-xl">
            {userBottomTabs.map(({ to, label, icon: Icon }) => {
              const isActive = isActivePath(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    'flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-black transition',
                    isActive
                      ? 'text-[#ffd83f]'
                      : 'text-white/56 hover:text-white',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-5 w-5',
                      isActive && 'drop-shadow-[0_0_10px_rgba(255,216,63,0.5)]',
                    )}
                    strokeWidth={isActive ? 2.8 : 2.2}
                  />
                  <span>{label}</span>
                </Link>
              );
            })}

            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className={cn(
                'flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-black transition',
                mobileMenuOpen
                  ? 'text-[#ffd83f]'
                  : 'text-white/56 hover:text-white',
              )}
            >
              <Menu className="h-5 w-5" strokeWidth={2.5} />
              <span>Menu</span>
            </button>
          </div>
        </nav>
      )}

      <Dialog open={topupOpen} onOpenChange={setTopupOpen}>
        <DialogContent className="w-[calc(100%-1.25rem)] max-w-sm rounded-2xl border-white/10 bg-[#11141f] p-5 text-white sm:w-full sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center text-white">
              Doładuj portfel
            </DialogTitle>
            <DialogDescription className="sr-only">
              Doładuj swój portfel o 100 zł raz dziennie.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-center">
            <p className="text-sm text-white/64">
              Doładuj swój portfel o{' '}
              <span className="font-black text-white">100 zł</span>. Możesz to
              zrobić raz dziennie.
            </p>
            <Button
              onClick={handleTopup}
              disabled={topupLoading}
              className="h-11 w-full bg-primary font-black text-primary-foreground hover:bg-primary/90"
            >
              {topupLoading ? 'Ładowanie...' : 'Doładuj 100 zł'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function MenuSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="px-1 text-[11px] font-black uppercase tracking-[0.18em] text-white/38">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
