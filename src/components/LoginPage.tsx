import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await signIn(email, password);
        toast.success("Zalogowano pomyślnie!");
      } else {
        await signUp(email, password, username);
        toast.success("Konto utworzone! Sprawdź email aby potwierdzić.");
      }
    } catch (err: any) {
      toast.error(err.message || "Wystąpił błąd");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-primary relative overflow-hidden flex flex-col items-center justify-center px-4">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-20 -right-20 w-96 h-96 opacity-10"
          style={{
            background:
              "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)",
          }}
        />
        <div
          className="absolute top-0 left-1/4 w-[600px] h-[200px] opacity-[0.07]"
          style={{
            background:
              "repeating-linear-gradient(-45deg, transparent, transparent 8px, rgba(255,255,255,0.15) 8px, rgba(255,255,255,0.15) 16px)",
            transform: "rotate(-15deg) translateY(-50px)",
          }}
        />
      </div>

      {/* Logo */}
      <div className="relative z-10 mb-8">
        <h1 className="text-4xl font-black text-primary-foreground tracking-tight">
          BSPLIC 2.0
        </h1>
      </div>

      {/* Card - compact, never full screen */}
      <div className="relative z-10 w-full max-w-sm">
        <div className="bg-card rounded-2xl shadow-2xl p-6 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-bold text-center text-card-foreground mb-5">
            {isLogin ? "Zaloguj się" : "Zarejestruj się"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-3">
            {!isLogin && (
              <div className="bg-muted rounded-xl px-4 pt-2.5 pb-2">
                <label className="block text-xs text-muted-foreground mb-0.5">
                  Nazwa użytkownika
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-transparent text-foreground text-sm font-medium outline-none"
                  placeholder="Twój nick"
                  required
                />
              </div>
            )}

            <div className="bg-muted rounded-xl px-4 pt-2.5 pb-2">
              <label className="block text-xs text-muted-foreground mb-0.5">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent text-foreground text-sm font-medium outline-none"
                placeholder="twoj@email.pl"
                required
              />
            </div>

            <div className="bg-muted rounded-xl px-4 pt-2.5 pb-2 flex items-center">
              <div className="flex-1">
                <label className="block text-xs text-muted-foreground mb-0.5">
                  Hasło
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent text-foreground text-sm font-medium outline-none"
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
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl text-base font-bold gradient-primary text-primary-foreground shadow-lg hover:brightness-110 transition"
            >
              {loading
                ? "Ładowanie..."
                : isLogin
                  ? "Zaloguj się"
                  : "Zarejestruj się"}
            </Button>
          </form>

          {isLogin && (
            <button className="w-full text-center mt-3 text-sm font-semibold text-primary hover:underline">
              Nie pamiętasz hasła?
            </button>
          )}
        </div>

        {/* Switch auth mode */}
        <div className="text-center mt-5">
          <p className="text-primary-foreground/70 text-sm">
            {isLogin ? "Chcesz otworzyć nowe konto?" : "Masz już konto?"}
          </p>
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary-foreground font-bold text-sm hover:underline mt-1"
          >
            {isLogin ? "Zarejestruj się" : "Zaloguj się"}
          </button>
        </div>
      </div>
    </div>
  );
}
