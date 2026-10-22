/**
 * Many two-decimal amounts land just off a whole cent once multiplied
 * (0.29 * 100 = 28.999…, 1.005 * 100 = 100.4999…); 12 significant digits put
 * them back before rounding, so the app matches Postgres `round(x, 2)`.
 */
const toCents = (value: number) => Number((value * 100).toPrecision(12));

/** Rounds to cents, halves away from zero (Postgres numeric `round`). */
export const roundMoney = (value: number) => (Math.sign(value) * Math.round(Math.abs(toCents(value)))) / 100;

/** Floors to cents: the most of a balance that can be staked. */
export const floorMoney = (value: number) => Math.floor(toCents(value)) / 100;
