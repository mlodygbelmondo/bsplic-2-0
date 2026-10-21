import { describe, expect, it } from 'vitest';

import { balancedSplit } from './balanced-split';

describe('balancedSplit', () => {
  it('moves the break so both lines are close in length', () => {
    // First layout at 343 pt: a long first line and a short second one.
    const result = balancedSplit(
      'PARI Universe Group B: BetBoom Team - Astra Invicta (BO3)',
      { text: 'PARI Universe Group B: BetBoom Team - ', width: 313 },
      { text: 'Astra Invicta (BO3)', width: 160 },
    );
    expect(result).toBe('PARI Universe Group B: BetBoom\nTeam - Astra Invicta (BO3)');
  });

  it('keeps a layout that is already even', () => {
    expect(
      balancedSplit(
        'Talia Gibson - Ashlyn Krueger',
        { text: 'Talia Gibson - ', width: 110 },
        { text: 'Ashlyn Krueger', width: 112 },
      ),
    ).toBeNull();
  });

  it('cannot split a single word', () => {
    expect(balancedSplit('Supercalifragilistic', { text: 'Supercalifragi', width: 200 }, { text: 'listic', width: 80 })).toBeNull();
  });
});
