import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, ArrowLeft, Mail } from "lucide-react";
import { toast } from "sonner";

type AuthView = "login" | "register" | "forgot" | "magic";

export function LoginPage() {
  const [view, setView] = useState<AuthView>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const { signIn, signUp, resetPassword, signInWithMagicLink } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (view === "login") {
        await signIn(email, password);
        toast.success("Zalogowano pomyślnie!");
      } else if (view === "register") {
        await signUp(email, password, username);
        toast.success("Konto utworzone! Sprawdź email aby potwierdzić.");
      }
    } catch (err: any) {
      toast.error(err.message || "Wystąpił błąd");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Wpisz swój adres e-mail");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email);
      toast.success("Link do resetowania hasła został wysłany na Twój e-mail!");
    } catch (err: any) {
      toast.error(err.message || "Wystąpił błąd");
    } finally {
      setLoading(false);
    }
  };

  const backgroundDecoration = (
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
  );

  if (view === "magic") {
    const handleMagicLink = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email) {
        toast.error("Wpisz swój adres e-mail");
        return;
      }
      setMagicLinkLoading(true);
      try {
        await signInWithMagicLink(email);
        toast.success("Link do logowania został wysłany na Twój e-mail!");
      } catch (err: any) {
        toast.error(err.message || "Wystąpił błąd");
      } finally {
        setMagicLinkLoading(false);
      }
    };

    return (
      <div className="min-h-screen gradient-primary relative overflow-hidden flex flex-col items-center justify-center px-4">
        {backgroundDecoration}
        <div className="relative z-10 mb-8">
          <h1 className="text-4xl font-black text-primary-foreground tracking-tight">BSPLIC 2.0</h1>
        </div>
        <div className="relative z-10 w-full max-w-sm">
          <div className="bg-card rounded-2xl shadow-2xl p-6 sm:p-8">
            <button
              onClick={() => setView("login")}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Wróć do logowania
            </button>

            <h2 className="text-xl sm:text-2xl font-bold text-center text-card-foreground mb-2">
              Zaloguj przez Magic Link
            </h2>
            <p className="text-sm text-muted-foreground text-center mb-5">
              Wpisz swój adres e-mail, a wyślemy Ci link do logowania.
            </p>

            <form onSubmit={handleMagicLink} className="space-y-3">
              <div className="bg-muted rounded-xl px-4 pt-2.5 pb-2">
                <label className="block text-xs text-muted-foreground mb-0.5">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent text-foreground text-sm font-medium outline-none"
                  placeholder="twoj@email.pl"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={magicLinkLoading}
                className="w-full h-11 rounded-xl text-base font-bold gradient-primary text-primary-foreground shadow-lg hover:brightness-110 transition"
              >
                <Mail className="h-4 w-4 mr-1" />
                {magicLinkLoading ? "Wysyłanie..." : "Wyślij Magic Link"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (view === "forgot") {
    return (
      <div className="min-h-screen gradient-primary relative overflow-hidden flex flex-col items-center justify-center px-4">
        {backgroundDecoration}
        <div className="relative z-10 mb-8">
          <h1 className="text-4xl font-black text-primary-foreground tracking-tight">BSPLIC 2.0</h1>
        </div>
        <div className="relative z-10 w-full max-w-sm">
          <div className="bg-card rounded-2xl shadow-2xl p-6 sm:p-8">
            <button
              onClick={() => setView("login")}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Wróć do logowania
            </button>

            <h2 className="text-xl sm:text-2xl font-bold text-center text-card-foreground mb-2">
              Nie pamiętasz hasła?
            </h2>
            <p className="text-sm text-muted-foreground text-center mb-5">
              Wpisz swój adres e-mail, a wyślemy Ci link do resetowania hasła.
            </p>

            <form onSubmit={handleForgotPassword} className="space-y-3">
              <div className="bg-muted rounded-xl px-4 pt-2.5 pb-2">
                <label className="block text-xs text-muted-foreground mb-0.5">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent text-foreground text-sm font-medium outline-none"
                  placeholder="twoj@email.pl"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl text-base font-bold gradient-primary text-primary-foreground shadow-lg hover:brightness-110 transition"
              >
                {loading ? "Wysyłanie..." : "Wyślij link"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const isLogin = view === "login";

  return (
    <div className="min-h-screen gradient-primary relative overflow-hidden flex flex-col items-center justify-center px-4">
      {backgroundDecoration}

      <div className="relative z-10 mb-8">
        <h1 className="text-4xl font-black text-primary-foreground tracking-tight">BSPLIC 2.0</h1>
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="bg-card rounded-2xl shadow-2xl p-6 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-bold text-center text-card-foreground mb-5">
            {isLogin ? "Zaloguj się" : "Zarejestruj się"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-3">
            {!isLogin && (
              <div className="bg-muted rounded-xl px-4 pt-2.5 pb-2">
                <label className="block text-xs text-muted-foreground mb-0.5">Nazwa użytkownika</label>
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
              <label className="block text-xs text-muted-foreground mb-0.5">E-mail</label>
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
                <label className="block text-xs text-muted-foreground mb-0.5">Hasło</label>
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
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl text-base font-bold gradient-primary text-primary-foreground shadow-lg hover:brightness-110 transition"
            >
              {loading ? "Ładowanie..." : isLogin ? "Zaloguj się" : "Zarejestruj się"}
            </Button>
          </form>

          {isLogin && (
            <div className="mt-4 space-y-3">
              <div className="relative flex items-center">
                <div className="flex-grow border-t border-border" />
                <span className="mx-3 text-xs text-muted-foreground">lub</span>
                <div className="flex-grow border-t border-border" />
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => setView("magic")}
                className="w-full h-11 rounded-xl text-sm font-semibold gap-2"
              >
                <Mail className="h-4 w-4" />
                Zaloguj przez Magic Link
              </Button>

              <button
                onClick={() => setView("forgot")}
                className="w-full text-center text-sm font-semibold text-primary hover:underline"
              >
                Nie pamiętasz hasła?
              </button>
            </div>
          )}
        </div>

        <div className="text-center mt-5">
          <p className="text-primary-foreground/70 text-sm">
            {isLogin ? "Chcesz otworzyć nowe konto?" : "Masz już konto?"}
          </p>
          <button
            onClick={() => setView(isLogin ? "register" : "login")}
            className="text-primary-foreground font-bold text-sm hover:underline mt-1"
          >
            {isLogin ? "Zarejestruj się" : "Zaloguj się"}
          </button>
        </div>
      </div>
    </div>
  );
}
