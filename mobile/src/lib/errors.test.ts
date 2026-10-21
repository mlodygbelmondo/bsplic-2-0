import { describe, expect, it } from 'vitest';

import { getErrorMessage } from './errors';

describe('getErrorMessage', () => {
  it('shows a server message as is', () => {
    expect(getErrorMessage(new Error('Niewystarczające saldo'), 'Nie udało się')).toBe('Niewystarczające saldo');
  });

  it('replaces transport failures with the Polish fallback', () => {
    expect(getErrorMessage(new TypeError('Network request failed'), 'Nie udało się skopiować kuponu')).toBe(
      'Nie udało się skopiować kuponu',
    );
    expect(getErrorMessage({ message: 'TypeError: Failed to fetch' }, 'Spróbuj ponownie')).toBe('Spróbuj ponownie');
  });

  it('falls back when there is no message', () => {
    expect(getErrorMessage('boom', 'Coś poszło nie tak')).toBe('Coś poszło nie tak');
  });
});
