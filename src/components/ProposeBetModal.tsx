import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { createBetProposal } from "@/features/home/api/betProposals";
import { Category } from "@/types/database";
import { toast } from "sonner";

interface ProposeBetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
}

interface OptionDraft {
  name: string;
  odds: string;
}

const FIXED_OPTION_COUNTS: Record<string, number> = {
  "12": 2,
  "1x2": 3,
};

const hasFixedOptionCount = (type: string) => type in FIXED_OPTION_COUNTS;

const OPTION_DEFAULTS: Record<"1x2" | "12" | "multi", string[]> = {
  "12": ["1", "2"],
  "1x2": ["1", "X", "2"],
  multi: ["", ""],
};

const toInputDateTime = (value: Date) => {
  const offsetDate = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
};

const getTomorrowAt2359 = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(23, 59, 0, 0);
  return date;
};

export function ProposeBetModal({
  open,
  onOpenChange,
  categories,
}: ProposeBetModalProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [betType, setBetType] = useState<"1x2" | "12" | "multi">("12");
  const [endsAt, setEndsAt] = useState(() => toInputDateTime(getTomorrowAt2359()));
  const [options, setOptions] = useState<OptionDraft[]>([
    { name: "1", odds: "2" },
    { name: "2", odds: "2" },
  ]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hasFixedOptionCount(betType)) {
      const optionCount = FIXED_OPTION_COUNTS[betType];
      setOptions((previous) =>
        Array.from({ length: optionCount }, (_, index) => ({
          name: previous[index]?.name ?? OPTION_DEFAULTS[betType][index] ?? "",
          odds:
            previous[index]?.odds ?? (betType === "1x2" && index === 1 ? "3" : "2"),
        })),
      );
    } else {
      setOptions((previous) =>
        previous.length >= 2
          ? previous
          : [
              { name: "", odds: "2" },
              { name: "", odds: "2" },
            ],
      );
    }
  }, [betType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const preparedOptions = options.map((option) => ({
      name: option.name.trim(),
      oddsRaw: option.odds.trim(),
    }));

    if (preparedOptions.some((option) => !option.name)) {
      toast.error("Uzupełnij etykiety wszystkich opcji");
      return;
    }

    if (preparedOptions.length < 2) {
      toast.error("Dodaj co najmniej 2 opcje");
      return;
    }

    const invalidOddsIndex = preparedOptions.findIndex((option) => {
      if (!option.oddsRaw) return true;
      const odds = Number(option.oddsRaw);
      return !Number.isFinite(odds) || odds <= 0;
    });

    if (invalidOddsIndex !== -1) {
      toast.error(`Podaj poprawny kurs dla opcji ${invalidOddsIndex + 1}`);
      return;
    }

    const normalizedOptions = preparedOptions.map((option) => ({
      name: option.name,
      odds: Number(option.oddsRaw),
    }));

    setLoading(true);

    try {
      await createBetProposal({
        userId: user.id,
        title,
        categoryId: categoryId || null,
        betType,
        options: normalizedOptions,
        endsAt,
      });

      toast.success("📋 Zakład zaproponowany — czeka na akceptację admina");
      onOpenChange(false);
      setTitle("");
      setCategoryId("");
      setBetType("12");
      setEndsAt(toInputDateTime(getTomorrowAt2359()));
      setOptions([
        { name: "1", odds: "2" },
        { name: "2", odds: "2" },
      ]);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Nie udało się wysłać propozycji";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[90vh] overflow-y-auto rounded-lg p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-bold">Zaproponuj zakład</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tytuł</Label>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="np. Kto wygra El Clasico?"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Kategoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.emoji} {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Typ</Label>
              <Select
                value={betType}
                onValueChange={(value: "1x2" | "12" | "multi") =>
                  setBetType(value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12">1/2</SelectItem>
                  <SelectItem value="1x2">1X2</SelectItem>
                  <SelectItem value="multi">Multi</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Data zakończenia</Label>
            <Input
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Opcje</Label>

            {options.map((option, index) => (
              <div key={index} className="flex gap-2 items-center">
                <Input
                  value={option.name}
                  onChange={(event) => {
                    const nextOptions = [...options];
                    nextOptions[index].name = event.target.value;
                    setOptions(nextOptions);
                  }}
                  placeholder={`Opcja ${index + 1}`}
                  className="flex-1"
                />
                <Input
                  type="number"
                  step="0.01"
                  min="1"
                  value={option.odds}
                  onChange={(event) => {
                    const nextOptions = [...options];
                    nextOptions[index].odds = event.target.value;
                    setOptions(nextOptions);
                  }}
                  className="w-24"
                  placeholder="Kurs"
                />
                {!hasFixedOptionCount(betType) && options.length > 2 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-destructive hover:text-destructive"
                    onClick={() =>
                      setOptions(options.filter((_, i) => i !== index))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}

            {!hasFixedOptionCount(betType) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setOptions([...options, { name: "", odds: "2" }])}
              >
                <Plus className="h-4 w-4 mr-1" /> Dodaj opcję
              </Button>
            )}
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full gradient-primary text-primary-foreground font-bold"
          >
            {loading ? "Wysyłanie..." : "Wyślij propozycję"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
