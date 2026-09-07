import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Info } from "lucide-react";
import { SLOT_GAMES, type SlotGame } from "./model";
import { SlotSymbol } from "./SlotBoard";

export function SlotRules({ game }: { game: SlotGame }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="slot-icon-button" aria-label="Zasady i wypłaty">
          <Info size={20} />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{SLOT_GAMES[game].title} · zasady</DialogTitle>
          <DialogDescription>
            {SLOT_GAMES[game].rule}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm leading-relaxed">
          <p>
            Wygrywające symbole znikają, a na ich
            miejsce spadają nowe. Jeden obrót obejmuje maksymalnie 12 układów.
            Łączna wypłata jest ograniczona do 500× stawki.
          </p>
          <p>
            {game === "bandit"
              ? "Wygrane zostawiają złote pola. Każda kolejna wygrana na takim polu zwiększa jego mnożnik, do 5×. Grupa korzysta z najwyższego mnożnika swoich pól. Pola zerują się przed następnym obrotem."
              : "Każdy wygrywający układ losuje równomiernie mnożnik od 1× do 5×, wspólny dla wszystkich grup tego układu."}
          </p>
          <p>
            4 lub więcej symboli BONUS na pierwszej planszy płatnego obrotu daje
            8 darmowych obrotów z tą samą stawką. Darmowe obroty nie przyznają
            kolejnych bonusów. Niewykorzystane obroty zostają na koncie.
          </p>
          <div className="rounded-xl bg-amber-500/10 p-3">
            <strong>Bonus</strong>
            <p>
              Bonus obejmuje losowe 5–15 płatnych obrotów, wspólnych dla obu gier.
              Każdy ma 35% szans na dodatkową pasującą grupę. Po zużyciu
              bonus odnawia się po losowych 12–36 godzinach. Darmowe obroty
              go nie zużywają. Niewykorzystane obroty nie wygasają ani się nie kumulują.
            </p>
          </div>
          <p>
            Każde pole losuje BONUS z szansą 2,5%. Każdy z pozostałych 7 symboli
            ma szansę 97,5% ÷ 7. Poniżej wypłata za minimalną grupę przed
            mnożnikiem.
          </p>
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 7 }, (_, symbol) => (
              <div
                key={symbol}
                className="rounded-xl bg-black/80 p-2 text-center text-white"
              >
                <div className="mx-auto h-12 w-12">
                  <SlotSymbol symbol={symbol} game={game} />
                </div>
                <span>
                  {(
                    (game === "bandit" ? 2.6 : 0.23) *
                    (1 + symbol * 0.25)
                  ).toFixed(3)}
                  ×
                </span>
              </div>
            ))}
          </div>
          <p>
            Każdy dodatkowy symbol w grupie mnoży jej bazową wypłatę przez 1,35.
            Bazowa wypłata jest zaokrąglana do 0,01 przed mnożnikiem. Wynik
            netto = wypłata − pobrana stawka.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
