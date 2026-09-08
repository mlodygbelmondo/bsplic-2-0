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
        <button
          className="slot-icon-button slot-rules-button"
          aria-label="Zasady i wypłaty"
        >
          <Info size={18} />
          <span>Zasady</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{SLOT_GAMES[game].title} · zasady</DialogTitle>
          <DialogDescription>{SLOT_GAMES[game].rule}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm leading-relaxed">
          <p>
            Ustaw stawkę i naciśnij „Zakręć”. Plansza ma 6 kolumn i 5 rzędów.
            Wypłaty ze wszystkich kaskad sumują się w jednym obrocie.
          </p>
          <p>
            Wygrywające symbole znikają, a na ich miejsce spadają nowe. Jeden
            obrót obejmuje maksymalnie 12 układów. Łączna wypłata jest
            ograniczona do 200× stawki.
          </p>
          <p>{SLOT_GAMES[game].multiplierRule}</p>
          <p>
            4 lub więcej symboli BONUS na pierwszej planszy płatnego obrotu daje
            10 darmowych obrotów z tą samą stawką. Darmowe obroty nie przyznają
            kolejnych bonusów. Niewykorzystane obroty zostają na koncie.
          </p>
          <div className="rounded-xl bg-amber-500/10 p-3">
            <strong>Lucky shot</strong>
            <p>
              Pierwszy płatny obrót po co najmniej 6 godzinach bez płatnej gry
              we wszystkich slotach ma 1% szans na lucky shot. Trafienie daje
              łączną wypłatę ×200 stawki, zamiast zwykłej wypłaty z planszy.
              Kolejne obroty i darmowe obroty nie biorą udziału w tym losowaniu.
            </p>
          </div>
          <p>
            Każde pole losuje BONUS z szansą 2,5%. Każdy z pozostałych 7 symboli
            ma szansę 97,5% ÷ 7. Poniżej wypłata za minimalną grupę przed mnożnikiem.
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
                  {(SLOT_GAMES[game].base * (1 + symbol * 0.25)).toFixed(3)}×
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
