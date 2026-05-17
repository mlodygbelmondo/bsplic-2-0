import { Lightbulb } from "lucide-react";

import { Button } from "@/components/ui/button";

interface HomeActionsBarProps {
  onProposeClick: () => void;
}

export function HomeActionsBar({ onProposeClick }: HomeActionsBarProps) {
  return (
    <div className="mb-2 flex shrink-0 items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">
          Oferta
        </p>
        <h2 className="truncate text-[17px] font-black leading-tight text-foreground">
          Zdarzenia sportowe
        </h2>
      </div>
      <Button
        onClick={onProposeClick}
        size="sm"
        className="propose-cta-button relative h-9 shrink-0 overflow-hidden rounded-md px-3 text-[12px] font-black text-primary-foreground shadow-md transition hover:brightness-110 sm:px-4 sm:text-[13px] gradient-cta"
      >
        <Lightbulb className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Zaproponuj zdarzenie</span>
        <span className="sm:hidden">Zaproponuj</span>
      </Button>
    </div>
  );
}
