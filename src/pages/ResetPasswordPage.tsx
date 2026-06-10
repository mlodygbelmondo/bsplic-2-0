import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function ResetPasswordPage() {
  usePageTitle("Reset hasła");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Hasła nie są takie same");
      return;
    }
    if (password.length < 6) {
      toast.error("Hasło musi mieć co najmniej 6 znaków");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Hasło zostało zmienione!");
      navigate("/");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Wystąpił błąd");
    } finally {
      setLoading(false);
    }
  };

  if (!isRecovery) {
    return (
      <div className="h-safe-screen safe-pad-y gradient-primary flex items-start md:items-center justify-center px-4 overflow-y-auto">
        <div className="bg-card rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-sm text-center">
          <h2 className="text-xl font-bold text-card-foreground mb-3">Nieprawidłowy link</h2>
          <p className="text-sm text-muted-foreground mb-5">
            Ten link do resetowania hasła jest nieprawidłowy lub wygasł.
          </p>
          <Button
            onClick={() => navigate("/")}
            className="gradient-primary text-primary-foreground font-bold"
          >
            Wróć do logowania
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-safe-screen safe-pad-y gradient-primary relative overflow-y-auto flex flex-col items-center justify-start md:justify-center px-4">
      <div className="relative z-10 mb-8">
        <h1 className="text-4xl font-black text-primary-foreground tracking-tight">BSPLIC 2.0</h1>
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="bg-card rounded-2xl shadow-2xl p-6 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-bold text-center text-card-foreground mb-2">
            Ustaw nowe hasło
          </h2>
          <p className="text-sm text-muted-foreground text-center mb-5">
            Wpisz nowe hasło do swojego konta.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="bg-muted rounded-xl px-4 pt-2.5 pb-2 flex items-center">
              <div className="flex-1">
                <label className="block text-xs text-muted-foreground mb-0.5">Nowe hasło</label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent text-foreground text-base font-medium outline-none"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-muted-foreground ml-2"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>

            <div className="bg-muted rounded-xl px-4 pt-2.5 pb-2">
              <label className="block text-xs text-muted-foreground mb-0.5">Potwierdź hasło</label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-transparent text-foreground text-base font-medium outline-none"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl text-base font-bold gradient-primary text-primary-foreground shadow-lg hover:brightness-110 transition"
            >
              {loading ? "Zapisywanie..." : "Zmień hasło"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
