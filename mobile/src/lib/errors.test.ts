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

  it('replaces expo/fetch failures and timeout aborts with the fallback', () => {
    // supabase-js wraps the thrown fetch error as `${name}: ${message}`.
    expect(getErrorMessage({ message: 'Error: fetch failed: Fetch request has been canceled' }, 'Spróbuj ponownie')).toBe(
      'Spróbuj ponownie',
    );
    expect(getErrorMessage({ message: 'AbortError: The operation was aborted.' }, 'Spróbuj ponownie')).toBe(
      'Spróbuj ponownie',
    );
  });

  it('replaces database-unavailable and gateway errors with the fallback', () => {
    expect(
      getErrorMessage(
        { message: 'Timed out acquiring connection from connection pool.', code: 'PGRST003' },
        'Spróbuj ponownie',
      ),
    ).toBe('Spróbuj ponownie');
    expect(
      getErrorMessage({ message: 'canceling statement due to statement timeout', code: '57014' }, 'Spróbuj ponownie'),
    ).toBe('Spróbuj ponownie');
    expect(getErrorMessage({ message: '<html><head><title>502 Bad Gateway</title>', code: '' }, 'Spróbuj ponownie')).toBe(
      'Spróbuj ponownie',
    );
    // Rethrown as `new Error(error.message)`: the code is gone, the text remains.
    expect(getErrorMessage(new Error('Timed out acquiring connection from connection pool.'), 'Spróbuj ponownie')).toBe(
      'Spróbuj ponownie',
    );
  });

  it('keeps a server error message that has a regular code', () => {
    expect(getErrorMessage({ message: 'Zakłady na ten mecz są zamknięte', code: 'P0001' }, 'Nie udało się')).toBe(
      'Zakłady na ten mecz są zamknięte',
    );
  });

  it('falls back when there is no message', () => {
    expect(getErrorMessage('boom', 'Coś poszło nie tak')).toBe('Coś poszło nie tak');
  });
});
