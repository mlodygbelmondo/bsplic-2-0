import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCoupon } from '@/contexts/CouponContext';
import { AuthModal } from './AuthModal';
import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, User, Ticket, Trophy, Menu, ShieldCheck } from 'lucide-react';

export function Navbar() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const { items } = useCoupon();
  const [authOpen, setAuthOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <nav className="gradient-navbar sticky top-0 z-50 border-b border-sidebar-border">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-xl font-black text-primary tracking-tight">
              BSPLIC 2.0
            </Link>
            {user && (
              <div className="hidden md:flex items-center gap-2">
                <Link to="/rankings" className="text-navbar-foreground hover:text-primary-foreground text-sm font-medium flex items-center gap-1">
                  <Trophy className="h-4 w-4" /> Rankingi
                </Link>
                {isAdmin && (
                  <Link to="/admin" className="text-navbar-foreground hover:text-primary-foreground text-sm font-medium flex items-center gap-1">
                    <ShieldCheck className="h-4 w-4" /> Admin
                  </Link>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {user && profile ? (
              <>
                <div className="hidden sm:flex items-center gap-2 bg-sidebar-accent px-3 py-1.5 rounded-lg">
                  <span className="text-sm font-bold text-primary">{Number(profile.balance).toFixed(0)} zł</span>
                </div>
                <button
                  onClick={() => navigate('/profile')}
                  className="flex items-center gap-2 text-navbar-foreground hover:text-primary-foreground text-sm"
                >
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline font-medium">{profile.username}</span>
                </button>
                <button onClick={() => signOut()} className="text-navbar-foreground hover:text-primary-foreground">
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <Button onClick={() => setAuthOpen(true)} size="sm" className="gradient-primary text-primary-foreground font-bold">
                Zaloguj się
              </Button>
            )}
          </div>
        </div>
      </nav>
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </>
  );
}
