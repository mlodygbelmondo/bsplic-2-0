export type SlotGameId = 'bandit' | 'candy' | 'ember' | 'tide';

/**
 * Hub tiles of the four slot games, in the web `SLOT_GAMES` order. Only the
 * fields the hub renders; the slot screens own the full game model.
 */
export const SLOT_TILES: readonly { id: SlotGameId; title: string; offset: number }[] = [
  { id: 'bandit', title: 'Midnight Bandit', offset: 0 },
  { id: 'candy', title: 'Candy Cascade', offset: 8 },
  { id: 'ember', title: 'Ember Forge', offset: 16 },
  { id: 'tide', title: 'Pearl Tide', offset: 24 },
];

/** Sprite indices shown on every slot tile; the middle one is large. */
export const SLOT_TILE_SYMBOLS = [1, 2, 6] as const;

export interface SlotSymbolSprite {
  sheet: 'symbols' | 'forge-tide';
  column: number;
  row: number;
}

/**
 * Cell of a 4×4 symbol sheet for a tile symbol (web `getSlotCardSymbolStyle`):
 * global indices 16+ live on the Ember Forge / Pearl Tide sheet.
 */
export function getSlotSymbolSprite(offset: number, index: number): SlotSymbolSprite {
  const globalIndex = offset + index;
  const spriteIndex = globalIndex % 16;
  return {
    sheet: globalIndex >= 16 ? 'forge-tide' : 'symbols',
    column: spriteIndex % 4,
    row: Math.floor(spriteIndex / 4),
  };
}

/** `.slot-lobby-symbol` widths: `clamp(4.5rem, 17vw, 8rem)` large, `clamp(3.35rem, 12vw, 5.8rem)` small. */
export function getSlotSymbolSize(windowWidth: number, large: boolean): number {
  return large
    ? Math.min(128, Math.max(72, windowWidth * 0.17))
    : Math.min(92.8, Math.max(53.6, windowWidth * 0.12));
}
