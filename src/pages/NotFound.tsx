import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";

const NotFound = () => {
  const location = useLocation();
  usePageTitle("404");

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex h-safe-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <h1 className="mb-2 text-5xl font-black tracking-tight">404</h1>
        <p className="mb-1 text-xl font-semibold">Ta strona nie istnieje</p>
        <p className="mb-6 text-sm text-muted-foreground">
          Sprawdź adres lub wróć na stronę główną.
        </p>
        <Link
          to="/"
          className="press-scale inline-flex h-11 items-center justify-center rounded-xl gradient-primary px-6 text-sm font-bold text-primary-foreground shadow-lg transition hover:brightness-110"
        >
          Wróć na stronę główną
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
