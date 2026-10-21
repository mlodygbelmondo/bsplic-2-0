import { describe, expect, it } from 'vitest';

import {
  addToSession,
  deriveMachine,
  frameDuration,
  idleFrame,
  INITIAL_FRAME,
  isFinalSpinError,
  isSlotGame,
  money,
  parsePending,
  parseSpin,
  parseStakeInput,
  parseState,
  paytableMultiplier,
  resultLabel,
  shouldAutoplayBonus,
  signedMoney,
  slotErrorMessage,
  steppedStake,
  symbolSprite,
  type MachineInputs,
} from './model';

const frame = {
  board: Array.from({ length: 30 }, () => 1),
  groups: [{ symbol: 1, cells: [0, 1, 2, 3, 4] }],
  gold: Array.from({ length: 30 }, () => 0),
  multiplier: 1,
  payout: 2,
};

const spin = {
  id: '11111111-1111-4111-8111-111111111111',
  game: 'bandit',
  stake: 5,
  charged: 5,
  payout: 2,
  net: -3,
  balance: 97,
  luckyShot: false,
  freeSpins: 0,
  awardedFreeSpins: 0,
  frames: [frame],
  createdAt: '2026-09-07T12:00:00Z',
};

const machine = (overrides: Partial<MachineInputs> = {}): MachineInputs => ({
  stakeInput: '5',
  freeSpins: 0,
  bonusStake: 5,
  pending: null,
  balance: 100,
  busy: false,
  animating: false,
  stopped: false,
  stateReady: true,
  stateError: false,
  offline: false,
  ...overrides,
});

describe('slot payloads', () => {
  it('accepts the fifteen-spin award from the server', () => {
    const awarded = { ...spin, freeSpins: 15, awardedFreeSpins: 15 };
    expect(parseSpin(awarded).awardedFreeSpins).toBe(15);
    expect(parseState({ freeSpins: 15, bonusStake: 5, history: [awarded] }).freeSpins).toBe(15);
  });

  it('rejects counts and boards outside the server contract', () => {
    expect(() => parseSpin({ ...spin, freeSpins: 16 })).toThrow();
    expect(() => parseSpin({ ...spin, frames: [] })).toThrow();
    expect(() => parseSpin({ ...spin, frames: Array.from({ length: 13 }, () => frame) })).toThrow();
    expect(() => parseSpin({ ...spin, frames: [{ ...frame, board: frame.board.slice(1) }] })).toThrow();
    expect(() => parseSpin({ ...spin, frames: [{ ...frame, board: [8, ...frame.board.slice(1)] }] })).toThrow();
    expect(() => parseSpin({ ...spin, frames: [{ ...frame, groups: [{ symbol: 7, cells: [0] }] }] })).toThrow();
    expect(() => parseSpin({ ...spin, frames: [{ ...frame, gold: [5, ...frame.gold.slice(1)] }] })).toThrow();
    expect(() => parseSpin({ ...spin, frames: [{ ...frame, multiplier: 6 }] })).toThrow();
    expect(() => parseSpin({ ...spin, id: 'not-a-uuid' })).toThrow();
    expect(() => parseSpin({ ...spin, game: 'poker' })).toThrow();
    expect(() => parseSpin({ ...spin, stake: 0 })).toThrow();
    expect(() => parseSpin({ ...spin, balance: -1 })).toThrow();
    expect(() => parseState({ freeSpins: 0, bonusStake: 5, history: Array.from({ length: 11 }, () => spin) })).toThrow();
  });

  it('keeps an absent lucky-shot flag absent and drops unknown fields', () => {
    const { luckyShot: _omitted, ...older } = spin;
    const parsed = parseSpin({ ...older, boostRemaining: 3 });
    expect('luckyShot' in parsed).toBe(false);
    expect('boostRemaining' in parsed).toBe(false);
    expect(parseState({ freeSpins: 0, bonusStake: 1, history: [], boostRemaining: 10 })).toEqual({
      freeSpins: 0,
      bonusStake: 1,
      history: [],
    });
  });
});

describe('formatting', () => {
  it('shows a payout below the stake as a net loss', () => {
    expect(resultLabel(-3)).toBe('Strata');
    expect(resultLabel(4)).toBe('Zysk');
    expect(resultLabel(0)).toBe('Na zero');
    expect(money(2)).toBe('2,00');
    expect(signedMoney(-3)).toBe('-3,00');
    expect(signedMoney(995)).toBe('+995,00');
  });

  it('groups thousands like pl-PL from five digits', () => {
    expect(money(1000)).toBe('1000,00');
    expect(money(12345.6)).toBe('12 345,60');
    expect(money(-1234567.891)).toBe('-1 234 567,89');
    expect(money(-0.001)).toBe('0,00');
  });

  it('lists the paytable for the minimal group before multipliers', () => {
    expect(Array.from({ length: 7 }, (_, s) => paytableMultiplier('bandit', s))).toEqual([
      '2,5654×',
      '3,20675×',
      '3,8481×',
      '4,48945×',
      '5,1308×',
      '5,77215×',
      '6,4135×',
    ]);
    expect(Array.from({ length: 7 }, (_, s) => paytableMultiplier('candy', s))).toEqual([
      '0,2111×',
      '0,263875×',
      '0,31665×',
      '0,369425×',
      '0,4222×',
      '0,474975×',
      '0,52775×',
    ]);
    expect(paytableMultiplier('ember', 6)).toBe('6,33×');
    expect(paytableMultiplier('tide', 3)).toBe('0,3689×');
  });
});

describe('symbols and boards', () => {
  it('maps each game to its slice of the two sprite sheets', () => {
    expect(symbolSprite('bandit', 7)).toEqual({ sheet: 'symbols', column: 3, row: 1, name: 'Szop' });
    expect(symbolSprite('candy', 0)).toEqual({ sheet: 'symbols', column: 0, row: 2, name: 'Serce' });
    expect(symbolSprite('ember', 0)).toEqual({ sheet: 'forgeTide', column: 0, row: 0, name: 'Żar' });
    expect(symbolSprite('tide', 7)).toEqual({ sheet: 'forgeTide', column: 3, row: 3, name: 'Łodzik' });
  });

  it('starts from the same idle board as the web', () => {
    expect(INITIAL_FRAME.board.slice(0, 12)).toEqual([0, 3, 6, 2, 5, 1, 5, 1, 4, 0, 3, 6]);
    expect(idleFrame('tide').multiplier).toBe(3);
    expect(idleFrame('ember').multiplier).toBe(1);
  });

  it('recognizes only the four games', () => {
    expect(isSlotGame('candy')).toBe(true);
    expect(isSlotGame('toString')).toBe(false);
    expect(isSlotGame(undefined)).toBe(false);
  });

  it('holds winning cascades longer and skips waits under reduced motion', () => {
    expect(frameDuration(2, false)).toBe(1100);
    expect(frameDuration(0, false)).toBe(450);
    expect(frameDuration(2, true)).toBe(60);
  });
});

describe('stake and spin controls', () => {
  it('parses stakes with a comma or dot and at most two decimals', () => {
    expect(parseStakeInput('250')).toBe(250);
    expect(parseStakeInput(' 2,5 ')).toBe(2.5);
    expect(parseStakeInput('1.25')).toBe(1.25);
    expect(parseStakeInput('')).toBeNull();
    expect(parseStakeInput('0.99')).toBeNull();
    expect(parseStakeInput('1.234')).toBeNull();
    expect(parseStakeInput('-5')).toBeNull();
    expect(steppedStake(5, 1)).toBe('6');
    expect(steppedStake(1.5, -1)).toBe('1');
    expect(steppedStake(null, 1)).toBe('1');
  });

  it('allows stakes above 100 when the wallet covers them', () => {
    const view = deriveMachine(machine({ stakeInput: '250', balance: 500 }));
    expect(view.actualStake).toBe(250);
    expect(view.canSpin).toBe(true);
    expect(view.spinLabel).toBe('ZAKRĘĆ');
  });

  it('prevents betting beyond the wallet and while account data is unavailable', () => {
    expect(deriveMachine(machine({ balance: 0 })).canSpin).toBe(false);
    expect(deriveMachine(machine({ stateReady: false })).canSpin).toBe(false);
    expect(deriveMachine(machine({ stateError: true })).canSpin).toBe(false);
  });

  it('disables spins offline, after ending the session and while a spin runs', () => {
    expect(deriveMachine(machine({ offline: true })).canSpin).toBe(false);
    expect(deriveMachine(machine({ stopped: true })).canSpin).toBe(false);
    expect(deriveMachine(machine({ busy: true }))).toMatchObject({ canSpin: false, spinLabel: 'LOSOWANIE' });
    expect(deriveMachine(machine({ animating: true }))).toMatchObject({ canSpin: false, spinLabel: 'KASKADA' });
  });

  it('lets users clear the stake input before typing a replacement', () => {
    const view = deriveMachine(machine({ stakeInput: '' }));
    expect(view.stakeText).toBe('');
    expect(view.stakeInputInvalid).toBe(true);
    expect(view.canSpin).toBe(false);
    expect(view.canIncrease).toBe(false);
  });

  it('locks the bonus stake and permits free spins with an empty wallet', () => {
    const view = deriveMachine(machine({ freeSpins: 3, bonusStake: 20, balance: 0, stakeInput: '5' }));
    expect(view.actualStake).toBe(20);
    expect(view.stakeText).toBe('20');
    expect(view.stakeLocked).toBe(true);
    expect(view.canSpin).toBe(true);
    expect(view.spinLabel).toBe('DARMOWY OBRÓT');
    expect(view.spinCost).toBe(0);
  });

  it('retries a pending request with its original stake', () => {
    const pending = { id: spin.id, stake: 7, bonusOnly: false };
    const view = deriveMachine(machine({ pending, stakeInput: '50', balance: 0 }));
    expect(view.actualStake).toBe(7);
    expect(view.spinLabel).toBe('SPRAWDŹ OBRÓT');
    expect(view.canSpin).toBe(true);
    expect(view.stakeLocked).toBe(true);
  });

  it('keeps − disabled at the minimum stake', () => {
    expect(deriveMachine(machine({ stakeInput: '1' })).canDecrease).toBe(false);
    expect(deriveMachine(machine({ stakeInput: '2' })).canDecrease).toBe(true);
  });
});

describe('bonus autoplay', () => {
  const base = {
    freeSpins: 2,
    paused: false,
    stopped: false,
    disabled: false,
    pending: false,
    error: false,
    stateReady: true,
    stateError: false,
    visible: true,
  };

  it('plays saved free spins automatically', () => {
    expect(shouldAutoplayBonus(base)).toBe(true);
  });

  it('never autoplays without free spins, while paused, stopped, failed or hidden', () => {
    expect(shouldAutoplayBonus({ ...base, freeSpins: 0 })).toBe(false);
    expect(shouldAutoplayBonus({ ...base, paused: true })).toBe(false);
    expect(shouldAutoplayBonus({ ...base, stopped: true })).toBe(false);
    expect(shouldAutoplayBonus({ ...base, error: true })).toBe(false);
    expect(shouldAutoplayBonus({ ...base, pending: true })).toBe(false);
    expect(shouldAutoplayBonus({ ...base, disabled: true })).toBe(false);
    expect(shouldAutoplayBonus({ ...base, visible: false })).toBe(false);
    expect(shouldAutoplayBonus({ ...base, stateReady: false })).toBe(false);
  });
});

describe('requests and session', () => {
  it('maps server errors to friendly copy', () => {
    expect(slotErrorMessage('INSUFFICIENT_BALANCE')).toBe('Za mało środków. Zmniejsz stawkę.');
    expect(slotErrorMessage('BONUS_FINISHED')).toBe('Bonus został już rozegrany. Odśwież grę.');
    expect(slotErrorMessage('Network request failed')).toBe(
      'Nie udało się potwierdzić obrotu. Ponów sprawdzenie tego samego obrotu.',
    );
  });

  it('forgets a request only after a definitive server answer', () => {
    expect(isFinalSpinError('P0001')).toBe(true);
    expect(isFinalSpinError('PGRST202')).toBe(true);
    expect(isFinalSpinError(undefined)).toBe(false);
    expect(isFinalSpinError('PGRST301')).toBe(false);
  });

  it('restores a stored pending request and ignores malformed ones', () => {
    expect(parsePending(JSON.stringify({ id: spin.id, stake: 5 }))).toEqual({ id: spin.id, stake: 5, bonusOnly: false });
    expect(parsePending(JSON.stringify({ id: spin.id, stake: 5, bonusOnly: true }))?.bonusOnly).toBe(true);
    expect(parsePending(JSON.stringify({ id: spin.id, stake: 0.5 }))).toBeNull();
    expect(parsePending(JSON.stringify({ id: 'x', stake: 5 }))).toBeNull();
    expect(parsePending('{broken')).toBeNull();
    expect(parsePending(undefined)).toBeNull();
  });

  it('sums the session net to the cent', () => {
    expect(addToSession({ spins: 2, net: 0.1 }, 0.2)).toEqual({ spins: 3, net: 0.3 });
  });
});
