import { Link } from "react-router-dom";
import { LogOut, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";

interface NavbarMobileMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  navLinks: { to: string; label: string }[];
  isActivePath: (path: string) => boolean;
  profile: Profile | null;
  canTopup: () => boolean;
  onOpenTopup: () => void;
  signOut: () => Promise<void>;
}

export default function NavbarMobileMenu({
  open,
  onOpenChange,
  navLinks,
  isActivePath,
  profile,
  canTopup,
  onOpenTopup,
  signOut,
}: NavbarMobileMenuProps) {
  const handleOpenTopup = () => {
    if (!canTopup()) {
      toast.error("Już doładowano dzisiaj. Wróć jutro!");
      return;
    }

    onOpenChange(false);
    onOpenTopup();
  };

  const handleSignOut = () => {
    onOpenChange(false);
    void signOut();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="safe-area-top duration-100 safe-area-bottom w-[86vw] max-w-sm p-0 border-l border-border"
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-border px-4 py-4">
            <SheetHeader className="text-left space-y-1">
              <SheetTitle className="text-base">Menu</SheetTitle>
            </SheetHeader>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
            <div className="space-y-1.5">
              {navLinks.map((link) => (
                <SheetClose asChild key={link.to}>
                  <Link
                    to={link.to}
                    className={cn(
                      "block rounded-md px-3 py-2.5 text-sm font-semibold transition-colors",
                      isActivePath(link.to)
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-muted",
                    )}
                  >
                    {link.label}
                  </Link>
                </SheetClose>
              ))}
            </div>

            {profile && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Saldo</span>
                  <span className="font-bold text-foreground">
                    {Number(profile.balance).toFixed(2)} zł
                  </span>
                </div>

                <button
                  onClick={handleOpenTopup}
                  className="w-full flex items-center justify-center gap-1 bg-primary/10 hover:bg-primary/15 text-primary px-3 py-2 rounded-md text-[12px] font-bold transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Doładuj 100 zł
                </button>

                <SheetClose asChild>
                  <Link
                    to="/profile"
                    className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-background transition-colors"
                  >
                    <Avatar className="h-7 w-7 bg-primary/10">
                      <AvatarImage
                        src={profile.avatar_url ?? undefined}
                        alt={`Avatar ${profile.username}`}
                      />
                      <AvatarFallback className="bg-primary/10 text-[11px] font-bold text-primary">
                        {profile.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-foreground">
                      {profile.username}
                    </span>
                  </Link>
                </SheetClose>
              </div>
            )}
          </div>

          <div className="border-t border-border p-4">
            <SheetClose asChild>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Wyloguj się
              </button>
            </SheetClose>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
