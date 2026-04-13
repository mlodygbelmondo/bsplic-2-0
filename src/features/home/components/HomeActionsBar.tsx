import { Button } from "@/components/ui/button";
import { Lightbulb } from "lucide-react";

interface HomeActionsBarProps {
  onProposeClick: () => void;
}

export function HomeActionsBar({ onProposeClick }: HomeActionsBarProps) {
  return (
    <div className="flex items-center justify-end mb-2 shrink-0">
      <Button
        onClick={onProposeClick}
        size="sm"
        className="propose-cta-button relative flex items-center overflow-hidden text-[14px] font-bold h-8 px-4 py-2 gradient-cta text-primary-foreground shadow-md hover:brightness-110 transition"
      >
        <Lightbulb className="h-3 w-3" /> Zaproponuj zakład
      </Button>
    </div>
  );
}
