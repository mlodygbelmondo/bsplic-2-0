import { motion, useReducedMotion } from "framer-motion";
import {
  SLOT_GAMES,
  SYMBOL_NAMES,
  type SlotFrame,
  type SlotGame,
} from "./model";

export function SlotSymbol({
  symbol,
  game,
}: {
  symbol: number;
  game: SlotGame;
}) {
  const index = SLOT_GAMES[game].offset + symbol;
  return (
    <span
      role="img"
      aria-label={SYMBOL_NAMES[index]}
      className="slot-symbol"
      style={{
        backgroundPosition: `${((index % 4) * 100) / 3}% ${(Math.floor(index / 4) * 100) / 3}%`,
      }}
    />
  );
}
export function SlotBoard({
  game,
  frame,
  spinning,
  step,
}: {
  game: SlotGame;
  frame: SlotFrame;
  spinning: boolean;
  step: number;
}) {
  const reduced = useReducedMotion();
  const winning = new Set(frame.groups.flatMap((group) => group.cells));
  return (
    <div
      className={`slot-board ${spinning ? "is-spinning" : ""}`}
      aria-label="Plansza gry, 6 kolumn i 5 rzędów"
      aria-busy={spinning}
    >
      {frame.board.map((symbol, cell) => (
        <div
          key={cell}
          className={`slot-cell ${winning.has(cell) && !spinning ? "is-winning" : ""} ${game === "bandit" && frame.gold[cell] > 0 ? "is-golden" : ""}`}
        >
          <motion.div
            key={`${step}-${cell}`}
            className="slot-symbol-wrap"
            initial={reduced ? false : { y: -25, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{
              duration: 0.25,
              delay: reduced ? 0 : (cell % 6) * 0.045,
            }}
          >
            <SlotSymbol symbol={symbol} game={game} />
          </motion.div>
          {symbol === 7 && <span className="slot-scatter">BONUS</span>}
          {game === "bandit" && frame.gold[cell] > 0 && (
            <span className="slot-cell-multiplier">
              ×{frame.gold[cell] + 1}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
