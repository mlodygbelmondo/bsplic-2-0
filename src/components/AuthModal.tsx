import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthModal({ open, onOpenChange }: AuthModalProps) {
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
        const { requiresEmailConfirmation } = await signUp(email, password, username);
        if (requiresEmailConfirmation) {
          toast.success("Konto utworzone! Sprawdź email, aby potwierdzić konto.");
        } else {
          toast.success("Konto utworzone i zalogowano automatycznie!");
        }
      }
      onOpenChange(false);
      setEmail("");
      setPassword("");
      setUsername("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Wystąpił błąd");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md gradient-primary border-0">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold text-primary-foreground">
            {isLogin ? "Zaloguj się" : "Zarejestruj się"}
          </DialogTitle>
        </DialogHeader>
        <div className="rounded-xl bg-card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="username">Nazwa użytkownika</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Twój nick"
                  className="bg-muted"
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="twoj@email.pl"
                className="bg-muted"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Hasło</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-muted pr-10"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full gradient-primary text-primary-foreground font-bold text-lg h-12"
              disabled={loading}
            >
              {loading
                ? "Ładowanie..."
                : isLogin
                  ? "Zaloguj się"
                  : "Zarejestruj się"}
            </Button>
          </form>
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="mt-4 w-full text-center text-sm text-primary hover:underline"
          >
            {isLogin
              ? "Chcesz otworzyć nowe konto? Zarejestruj się"
              : "Masz już konto? Zaloguj się"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
