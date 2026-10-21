import type { SlotGame, SymbolSheet } from './model';

/** Game art (web `/casino/slots/<game>.webp`), also used by the casino hub tiles. */
export const SLOT_ART: Record<SlotGame, number> = {
  bandit: require('../../../assets/images/casino/slots/bandit.webp'),
  candy: require('../../../assets/images/casino/slots/candy.webp'),
  ember: require('../../../assets/images/casino/slots/ember.webp'),
  tide: require('../../../assets/images/casino/slots/tide.webp'),
};

/** 4 × 4 symbol sprite sheets (web `/casino/slots/symbols*.webp`). */
export const SYMBOL_SHEETS: Record<SymbolSheet, number> = {
  symbols: require('../../../assets/images/casino/slots/symbols.webp'),
  forgeTide: require('../../../assets/images/casino/slots/symbols-forge-tide.webp'),
};
