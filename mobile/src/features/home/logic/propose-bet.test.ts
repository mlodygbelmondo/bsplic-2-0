import { describe, expect, it } from 'vitest';

import { getTomorrowAt2359, reshapeOptionsForType, validateProposalOptions } from './propose-bet';

describe('reshapeOptionsForType', () => {
  it('keeps names by index and fills new rows with the type defaults', () => {
    const result = reshapeOptionsForType(
      [
        { name: 'Legia', odds: '1.5' },
        { name: 'Lech', odds: '2.5' },
      ],
      '1x2',
    );

    expect(result).toEqual([
      { name: 'Legia', odds: '1.5' },
      { name: 'Lech', odds: '2.5' },
      { name: '2', odds: '2' },
    ]);
  });

  it('defaults the draw odds to 3 when growing a single into 1x2', () => {
    expect(reshapeOptionsForType([{ name: '1', odds: '2' }], '1x2')).toEqual([
      { name: '1', odds: '2' },
      { name: 'X', odds: '3' },
      { name: '2', odds: '2' },
    ]);
  });

  it('trims rows down to the fixed count', () => {
    expect(
      reshapeOptionsForType(
        [
          { name: 'A', odds: '2' },
          { name: 'B', odds: '2' },
          { name: 'C', odds: '2' },
        ],
        'single',
      ),
    ).toEqual([{ name: 'A', odds: '2' }]);
  });

  it('keeps existing rows for multi, or starts with two blank ones', () => {
    const rows = [
      { name: 'A', odds: '2' },
      { name: 'B', odds: '3' },
    ];

    expect(reshapeOptionsForType(rows, 'multi')).toBe(rows);
    expect(reshapeOptionsForType([{ name: 'A', odds: '2' }], 'multi')).toEqual([
      { name: '', odds: '2' },
      { name: '', odds: '2' },
    ]);
  });
});

describe('validateProposalOptions', () => {
  it('requires every option label first', () => {
    expect(validateProposalOptions([{ name: ' ', odds: 'abc' }, { name: 'B', odds: '2' }], '12')).toEqual({
      ok: false,
      message: 'Uzupełnij etykiety wszystkich opcji',
    });
  });

  it('requires two options for multi bets and one for single bets', () => {
    expect(validateProposalOptions([{ name: 'A', odds: '2' }], 'multi')).toEqual({
      ok: false,
      message: 'Dodaj co najmniej 2 opcje',
    });
    expect(validateProposalOptions([], 'single')).toEqual({ ok: false, message: 'Dodaj co najmniej 1 opcję' });
  });

  it('names the first option with invalid odds (1-based)', () => {
    expect(
      validateProposalOptions(
        [
          { name: 'A', odds: '2' },
          { name: 'B', odds: '0' },
          { name: 'C', odds: '' },
        ],
        'multi',
      ),
    ).toEqual({ ok: false, message: 'Podaj poprawny kurs dla opcji 2' });
  });

  it('returns trimmed names and numeric odds, reading a comma as the decimal separator', () => {
    expect(
      validateProposalOptions(
        [
          { name: ' Tak ', odds: '1,85' },
          { name: 'Nie', odds: ' 2.1 ' },
        ],
        '12',
      ),
    ).toEqual({
      ok: true,
      options: [
        { name: 'Tak', odds: 1.85 },
        { name: 'Nie', odds: 2.1 },
      ],
    });
  });
});

describe('getTomorrowAt2359', () => {
  it('returns the next calendar day at 23:59 local time', () => {
    const result = getTomorrowAt2359(new Date(2030, 0, 31, 10, 15));

    expect([result.getFullYear(), result.getMonth(), result.getDate(), result.getHours(), result.getMinutes()]).toEqual([
      2030, 1, 1, 23, 59,
    ]);
  });
});
