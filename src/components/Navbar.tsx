import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCoupon } from '@/contexts/CouponContext';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, User, ShieldCheck, Plus } from 'lucide-react';

export function Navbar() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const { items } = useCoupon();
  const navigate = useNavigate();

  return (
    <nav className="gradient-navbar sticky top-0 z-50">
      <div className="flex items-center justify-between px-4 h-11 max-w-[1600px] mx-auto">
        {/* Left */}
        <div className="flex items-center gap-5">
          <Link to="/" className="text-[15px] font-black text-primary italic tracking-tight">
            BSPLIC 2.0
          </Link>
          <div className="hidden md:flex items-center gap-4">
            <Link to="/" className="text-[13px] font-semibold text-navbar-foreground hover:text-primary-foreground transition-colors">
              Zakłady sportowe
            </Link>
            <Link to="/rankings" className="text-[13px] font-semibold text-navbar-foreground/70 hover:text-navbar-foreground transition-colors">
              Rankingi
            </Link>
            {isAdmin && (
              <Link to="/admin" className="text-[13px] font-semibold text-navbar-foreground/70 hover:text-navbar-foreground transition-colors flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" /> Admin
              </Link>
            )}
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {profile && (
            <button
              onClick={() => navigate('/profile')}
              className="flex items-center gap-1 bg-[hsl(145,60%,40%)] hover:bg-[hsl(145,60%,35%)] text-[hsl(0,0%,100%)] px-2.5 py-1 rounded-full text-[12px] font-bold transition-colors"
            >
              <Plus className="h-3 w-3" />
              {Number(profile.balance).toFixed(0)} zł
            </button>
          )}
          {profile && (
            <Link
              to="/profile"
              className="flex items-center gap-1.5 text-navbar-foreground text-[12px] font-medium"
            >
              <div className="h-6 w-6 rounded-full bg-[hsl(220,15%,25%)] flex items-center justify-center text-[10px] font-bold text-navbar-foreground">
                {profile.username.charAt(0).toUpperCase()}
              </div>
              <span className="hidden sm:inline">{profile.username}</span>
            </Link>
          )}
          <button
            onClick={() => signOut()}
            className="text-navbar-foreground/50 hover:text-navbar-foreground transition-colors ml-1"
            title="Wyloguj"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </nav>
  );
}
