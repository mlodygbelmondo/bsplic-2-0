import { describe, expect, it } from 'vitest';

import type { Bet } from '@/types/database';

import {
  createBetEditor,
  createFormOptions,
  relockEditorOptions,
  validateBetEditor,
  validateNewBet,
  type BetEditorDraft,
  type NewBetDraft,
  type OptionDraft,
} from './bet-form';

const option = (name: string, odds: string, key: string): OptionDraft => ({ name, odds, key });

const editor = (overrides: Partial<BetEditorDraft> = {}): BetEditorDraft => ({
  id: 'bet-1',
  title: 'Derby',
  categoryId: '',
  betType: '12',
  options: [option('1', '2', 'a'), option('2', '2.5', 'b')],
  endsAt: new Date('2030-01-01T12:00:00.000Z'),
  isLive: false,
  isBsplicboost: true,
  isActive: true,
  akoExclusions: [],
  ...overrides,
});

const newBet = (overrides: Partial<NewBetDraft> = {}): NewBetDraft => ({
  title: 'Kto wygra?',
  categoryId: 'category-1',
  betType: '12',
  options: [option('1', '2', 'a'), option('2', '2', 'b')],
  endsAt: new Date('2030-01-01T12:00:00.000Z'),
  isLive: false,
  isBsplicboost: false,
  akoExclusions: [],
  ...overrides,
});

const ready = { loading: false, failed: false };

describe('validateBetEditor', () => {
  it('blocks saving while AKO exclusions load or after they failed, before any other check', () => {
    expect(validateBetEditor(editor({ title: '' }), { loading: true, failed: false })).toEqual({
      ok: false,
      message: 'Poczekaj, aż wykluczenia AKO się wczytają',
    });
    expect(validateBetEditor(editor({ title: '' }), { loading: false, failed: true })).toEqual({
      ok: false,
      message: 'Wykluczenia AKO nie wczytały się poprawnie',
    });
  });

  it('checks the title before option labels', () => {
    expect(validateBetEditor(editor({ title: '  ', options: [option('', '2', 'a')] }), ready)).toEqual({
      ok: false,
      message: 'Tytuł jest wymagany',
    });
  });

  it('names the first option with invalid odds', () => {
    const result = validateBetEditor(
      editor({ options: [option('1', '2', 'a'), option('2', '0', 'b')] }),
      ready,
    );
    expect(result).toEqual({ ok: false, message: 'Podaj poprawny kurs dla opcji 2' });
  });

  it('requires two options for non-single bets', () => {
    expect(
      validateBetEditor(editor({ betType: 'multi', options: [option('A', '2', 'a')] }), ready),
    ).toEqual({ ok: false, message: 'Zakład musi mieć minimum 2 opcje' });
  });

  it('rejects an invalid end date', () => {
    expect(validateBetEditor(editor({ endsAt: new Date('nope') }), ready)).toEqual({
      ok: false,
      message: 'Wybierz poprawną datę zakończenia',
    });
  });

  it('builds the update payload with trimmed values and numeric odds', () => {
    const result = validateBetEditor(
      editor({ title: ' Derby ', options: [option(' 1 ', '2', 'a'), option('2', '2,5', 'b')] }),
      ready,
    );
    expect(result).toEqual({
      ok: true,
      value: {
        betId: 'bet-1',
        title: 'Derby',
        categoryId: null,
        betType: '12',
        options: [
          { name: '1', odds: 2 },
          { name: '2', odds: 2.5 },
        ],
        endsAt: '2030-01-01T12:00:00.000Z',
        isLive: false,
        isBsplicboost: true,
        isActive: true,
        exclusions: [],
      },
    });
  });
});

describe('validateNewBet', () => {
  it('checks option labels before the title', () => {
    expect(validateNewBet(newBet({ title: '', options: [option('', '2', 'a'), option('2', '2', 'b')] }))).toEqual({
      ok: false,
      message: 'Uzupełnij etykiety wszystkich opcji',
    });
  });

  it('checks the option count before odds', () => {
    expect(validateNewBet(newBet({ betType: 'multi', options: [option('A', 'x', 'a')] }))).toEqual({
      ok: false,
      message: 'Dodaj co najmniej 2 opcje',
    });
  });

  it('checks odds before the title', () => {
    expect(validateNewBet(newBet({ title: '', options: [option('1', '', 'a'), option('2', '2', 'b')] }))).toEqual({
      ok: false,
      message: 'Podaj poprawny kurs dla opcji 1',
    });
  });

  it('requires a title last', () => {
    expect(validateNewBet(newBet({ title: '   ' }))).toEqual({ ok: false, message: 'Tytuł jest wymagany' });
  });

  it('sends no category when none is picked', () => {
    const result = validateNewBet(newBet({ categoryId: '' }));
    expect(result.ok && result.value.categoryId).toBeNull();
  });
});

describe('option rows', () => {
  it('uses the web defaults for each create type', () => {
    expect(createFormOptions('single').map(({ name, odds }) => [name, odds])).toEqual([['1', '2']]);
    expect(createFormOptions('1x2').map(({ name, odds }) => [name, odds])).toEqual([
      ['1', '2'],
      ['X', '3'],
      ['2', '2'],
    ]);
  });

  it('keeps existing multi rows when there are at least two', () => {
    const rows = [option('A', '2', 'a'), option('B', '3', 'b'), option('C', '4', 'c')];
    expect(createFormOptions('multi', rows)).toBe(rows);
    expect(createFormOptions('multi', [option('A', '2', 'a')]).map(({ name }) => name)).toEqual(['', '']);
  });

  it('keeps row keys when the edit form re-locks options for a new type', () => {
    const rows = [option('Tak', '1.5', 'a'), option('Nie', '2.5', 'b'), option('Może', '4', 'c')];
    const relocked = relockEditorOptions('12', rows);
    expect(relocked).toEqual([option('Tak', '1.5', 'a'), option('Nie', '2.5', 'b')]);
  });

  it('maps a bet into the editor with minute precision', () => {
    const bet: Bet = {
      id: 'bet-9',
      title: 'Mecz',
      category_id: null,
      bet_type: '1x2',
      options: [{ name: 'Gospodarze', odds: 1.8 }],
      ends_at: '2030-01-01T12:34:56.789Z',
      is_live: true,
      is_active: false,
      winning_option: null,
      bet_count: 3,
      created_at: '2029-12-01T10:00:00.000Z',
    };
    const draft = createBetEditor(bet);
    expect(draft.options.map(({ name, odds }) => [name, odds])).toEqual([
      ['Gospodarze', '1.8'],
      ['X', '3'],
      ['2', '2'],
    ]);
    expect(draft.endsAt.toISOString()).toBe('2030-01-01T12:34:00.000Z');
    expect(draft).toMatchObject({ categoryId: '', isLive: true, isBsplicboost: false, isActive: false });
  });
});
