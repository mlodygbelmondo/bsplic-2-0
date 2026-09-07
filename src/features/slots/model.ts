import { z } from "zod";

export type SlotGame = "bandit" | "candy";
export const SLOT_GAMES = {
  bandit: {
    title: "Midnight Bandit",
    rule: "5+ jednakowych symboli stykających się bokami",
    image: "/casino/slots/bandit.webp",
    offset: 0,
  },
  candy: {
    title: "Candy Cascade",
    rule: "8+ jednakowych symboli w dowolnych miejscach",
    image: "/casino/slots/candy.webp",
    offset: 8,
  },
} as const;
export const SYMBOL_NAMES = [
  "Szmaragd",
  "Moneta",
  "Rubin",
  "Szafir",
  "Worek",
  "Klucz",
  "Korona",
  "Szop",
  "Serce",
  "Cukierek",
  "Diament",
  "Winogrona",
  "Banany",
  "Arbuz",
  "Jabłko",
  "Lizak",
];
const frameSchema = z.object({
  board: z.array(z.number().int().min(0).max(7)).length(30),
  groups: z.array(
    z.object({
      symbol: z.number().int().min(0).max(6),
      cells: z.array(z.number().int().min(0).max(29)),
    }),
  ),
  gold: z.array(z.number().int().min(0).max(4)).length(30),
  multiplier: z.number().int().min(1).max(5),
  payout: z.number().finite().nonnegative(),
});
export const spinSchema = z.object({
  id: z.string().uuid(),
  game: z.enum(["bandit", "candy"]),
  stake: z.number().finite().positive(),
  charged: z.number().finite().nonnegative(),
  payout: z.number().finite().nonnegative(),
  net: z.number().finite(),
  balance: z.number().finite().nonnegative(),
  boosted: z.boolean(),
  boostRemaining: z.number().int().min(0).max(15),
  freeSpins: z.number().int().min(0).max(8),
  awardedFreeSpins: z.number().int().min(0).max(8),
  frames: z.array(frameSchema).min(1).max(12),
  createdAt: z.string(),
});
export const stateSchema = z.object({
  boostRemaining: z.number().int().min(0).max(15),
  freeSpins: z.number().int().min(0).max(8),
  bonusStake: z.number().positive(),
  history: z.array(spinSchema).max(10),
});
export type SlotSpin = z.infer<typeof spinSchema>;
export type SlotFrame = z.infer<typeof frameSchema>;
export const INITIAL_FRAME: SlotFrame = {
  board: Array.from({ length: 30 }, (_, i) => (i * 3 + Math.floor(i / 6)) % 7),
  groups: [],
  gold: Array(30).fill(0),
  multiplier: 1,
  payout: 0,
};
export const money = (value: number) =>
  value.toLocaleString("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export function resultLabel(net: number) {
  return net > 0 ? "Zysk" : net < 0 ? "Strata" : "Na zero";
}
