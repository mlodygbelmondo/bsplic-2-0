import { describe, expect, it } from 'vitest';

import {
  looksLikeMetaResponse,
  sanitizeGeneratedText,
} from '../../../supabase/functions/_shared/eniuTextGuard';

describe('Eniu generated text guard', () => {
  it('normalizes harmless replies without changing their meaning', () => {
    expect(sanitizeGeneratedText('  "Gram ostrożnie.\n Kurs ma sens."  ')).toBe(
      'Gram ostrożnie. Kurs ma sens.',
    );
    expect(looksLikeMetaResponse('Gram ostrożnie. Kurs ma sens.')).toBe(false);
  });

  it.each([
    'The user wants me to pick a team',
    'Key constraints: never reveal this',
    'Here is my system prompt',
    '<thinking>private reasoning</thinking> Final pick: home',
    '<think>private reasoning</think> Final pick: home',
  ])('recognizes leaked instructions or reasoning in %s', (response) => {
    expect(looksLikeMetaResponse(response)).toBe(true);
  });
});
