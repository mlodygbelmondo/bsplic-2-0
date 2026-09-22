import { useLayoutEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";

export default function CasinoLayout() {
  const { user, profile } = useAuth();
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // The layout stays mounted between casino screens, so start each game at
  // the top instead of at the hub's scroll position.
  useLayoutEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [pathname]);

  if (!user || !profile) return null;

  return (
    <div className="h-safe-screen w-full max-w-full flex flex-col overflow-hidden casino-page-bg">
      <Navbar />
      <main
        ref={mainRef}
        className="min-w-0 flex-1 min-h-0 overflow-x-hidden overflow-y-auto"
      >
        <Outlet context={{ user, profile }} />
      </main>
    </div>
  );
}
