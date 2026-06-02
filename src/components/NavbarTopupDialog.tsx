import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/types/database";

interface NavbarTopupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
}

export default function NavbarTopupDialog({
  open,
  onOpenChange,
  userId,
  profile,
  refreshProfile,
}: NavbarTopupDialogProps) {
  const [topupLoading, setTopupLoading] = useState(false);

  const handleTopup = async () => {
    if (!userId || !profile) return;
    setTopupLoading(true);
    try {
      const { error } = await supabase.rpc("secure_daily_topup", {
        p_user_id: userId,
      });
      if (error) {
        toast.error(error.message || "Błąd doładowania");
        return;
      }
      await refreshProfile();
      toast.success("💰 Doładowano 100 zł. Wróć jutro po więcej!");
      onOpenChange(false);
    } catch {
      toast.error("Błąd doładowania");
    } finally {
      setTopupLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.25rem)] max-w-sm rounded-xl p-5 sm:w-full sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">💰 Doładuj portfel</DialogTitle>
        </DialogHeader>
        <div className="text-center space-y-4 py-2">
          <p className="text-muted-foreground text-sm">
            Doładuj swój portfel o{" "}
            <span className="font-bold text-foreground">100 zł</span>. Możesz to
            zrobić raz dziennie.
          </p>
          <Button
            onClick={handleTopup}
            disabled={topupLoading}
            className="w-full gradient-primary text-primary-foreground font-bold h-11"
          >
            {topupLoading ? "Ładowanie..." : "Doładuj 100 zł"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
