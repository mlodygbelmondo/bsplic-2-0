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
            ograniczona do 500× stawki.
          </p>
          <p>{SLOT_GAMES[game].multiplierRule}</p>
          <p>
            4 lub więcej symboli BONUS na pierwszej planszy płatnego obrotu daje
            8 darmowych obrotów z tą samą stawką. Darmowe obroty nie przyznają
            kolejnych bonusów. Niewykorzystane obroty zostają na koncie.
          </p>
          <div className="rounded-xl bg-amber-500/10 p-3">
            <strong>Bonus</strong>
            <p>
              Bonus obejmuje losowe 5–15 płatnych obrotów, wspólnych dla
              wszystkich slotów. Podczas bonusu każdy płatny obrót ma 90% szans
              na dodanie grupy dającej wypłatę większą od stawki. Po bonusie ta
              szansa wynosi 60%. Pozostałe losowania też mogą wygrać naturalnie.
              Po zużyciu bonus odnawia się po losowych 12–36 godzinach. Darmowe
              obroty go nie zużywają. Niewykorzystane obroty nie wygasają ani
              się nie kumulują.
            </p>
          </div>
          <p>
            Przed dodaniem grupy każde pole losuje BONUS z szansą 2,5%. Każdy z
            pozostałych 7 symboli ma szansę 97,5% ÷ 7. Dodana grupa zastępuje 5
            pól w Bandit i Ember albo 13 pól w Candy i Tide, także gdy był na
            nich BONUS. Poniżej wypłata za minimalną grupę przed mnożnikiem.
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
