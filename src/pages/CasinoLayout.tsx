import { Outlet } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";

export default function CasinoLayout() {
  const { user, profile } = useAuth();

  if (!user || !profile) return null;

  return (
    <div className="h-safe-screen w-full max-w-full flex flex-col overflow-hidden casino-page-bg">
      <Navbar />
      <main className="min-w-0 flex-1 min-h-0 overflow-x-hidden overflow-y-auto">
        <Outlet context={{ user, profile }} />
      </main>
    </div>
  );
}
