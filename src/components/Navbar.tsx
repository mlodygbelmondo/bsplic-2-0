import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCoupon } from '@/contexts/CouponContext';
import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, User, Trophy, ShieldCheck, Wallet, Receipt } from 'lucide-react';

export function Navbar() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const { items } = useCoupon();
  const navigate = useNavigate();

  return (
    <nav className="gradient-navbar sticky top-0 z-50">
      <div className="flex items-center justify-between px-4 h-12">
        {/* Left: Logo + Nav links */}
        <div className="flex items-center gap-6">
          <Link to="/" className="text-lg font-black text-primary tracking-tight mr-2">
            BSPLIC 2.0
          </Link>
          <div className="hidden md:flex items-center gap-4">
            <Link to="/" className="text-navbar-foreground/80 hover:text-navbar-foreground text-[13px] font-semibold transition-colors">
              Zakłady sportowe
            </Link>
            <Link to="/rankings" className="text-navbar-foreground/80 hover:text-navbar-foreground text-[13px] font-semibold transition-colors">
              Rankingi
            </Link>
            {isAdmin && (
              <Link to="/admin" className="text-navbar-foreground/80 hover:text-navbar-foreground text-[13px] font-semibold flex items-center gap-1 transition-colors">
                <ShieldCheck className="h-3.5 w-3.5" /> Admin
              </Link>
            )}
          </div>
        </div>

        {/* Right: Balance + User */}
        <div className="flex items-center gap-3">
          {profile && (
            <button 
              onClick={() => navigate('/profile')}
              className="flex items-center gap-1.5 bg-sidebar-accent hover:bg-sidebar-accent/80 px-3 py-1.5 rounded-full transition-colors"
            >
              <Wallet className="h-3.5 w-3.5 text-success" />
              <span className="text-[13px] font-bold text-navbar-foreground">{Number(profile.balance).toFixed(0)} zł</span>
            </button>
          )}
          {profile && (
            <Link 
              to="/profile" 
              className="flex items-center gap-1.5 text-navbar-foreground/80 hover:text-navbar-foreground text-[13px] transition-colors"
            >
              <div className="h-7 w-7 rounded-full bg-sidebar-accent flex items-center justify-center">
                <User className="h-3.5 w-3.5" />
              </div>
              <span className="hidden sm:inline font-medium">{profile.username}</span>
            </Link>
          )}
          <button 
            onClick={() => signOut()} 
            className="text-navbar-foreground/50 hover:text-navbar-foreground transition-colors"
            title="Wyloguj"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}
