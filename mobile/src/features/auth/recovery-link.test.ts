import { describe, expect, it } from 'vitest';

import { parseParamString, parseRecoveryLink, parseRecoveryUrl, readJwtSubject } from './recovery-link';

const RECOVERY_HASH =
  'access_token=eyJ.a.b&expires_at=1792000000&expires_in=3600&refresh_token=r3fr35h&token_type=bearer&type=recovery';

describe('parseRecoveryLink', () => {
  it('reads implicit-flow recovery tokens from the hash', () => {
    expect(parseRecoveryLink({ hash: RECOVERY_HASH })).toEqual({
      kind: 'tokens',
      accessToken: 'eyJ.a.b',
      refreshToken: 'r3fr35h',
    });
  });

  it('accepts a hash that still has its leading #', () => {
    expect(parseRecoveryLink({ hash: `#${RECOVERY_HASH}` }).kind).toBe('tokens');
  });

  it('ignores session tokens that are not a password recovery (e.g. a signup confirmation)', () => {
    const signupHash = RECOVERY_HASH.replace('type=recovery', 'type=signup');
    expect(parseRecoveryLink({ hash: signupHash })).toEqual({ kind: 'none' });
  });

  it('reads a PKCE code from the query', () => {
    expect(parseRecoveryLink({ hash: '', query: { code: 'abc-123' } })).toEqual({ kind: 'code', code: 'abc-123' });
  });

  it('reports an expired link from the hash with the decoded description', () => {
    const hash = 'error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';
    expect(parseRecoveryLink({ hash })).toEqual({ kind: 'error', message: 'Email link is invalid or has expired' });
  });

  it('reports an error passed as a query parameter', () => {
    expect(parseRecoveryLink({ query: { error_description: 'Link wygasł' } })).toEqual({
      kind: 'error',
      message: 'Link wygasł',
    });
  });

  it('returns none when the page is opened without recovery parameters', () => {
    expect(parseRecoveryLink({ hash: null, query: {} })).toEqual({ kind: 'none' });
  });
});

describe('parseRecoveryUrl', () => {
  it('parses a universal link with a recovery hash', () => {
    expect(parseRecoveryUrl(`https://bsplic.vercel.app/reset-password#${RECOVERY_HASH}`)).toEqual({
      kind: 'tokens',
      accessToken: 'eyJ.a.b',
      refreshToken: 'r3fr35h',
    });
  });

  it('parses an app-scheme link with a PKCE code', () => {
    expect(parseRecoveryUrl('bsplic://reset-password?code=xyz')).toEqual({ kind: 'code', code: 'xyz' });
  });

  it('ignores links to other routes', () => {
    expect(parseRecoveryUrl(`https://bsplic.vercel.app/social#${RECOVERY_HASH}`)).toBeNull();
    expect(parseRecoveryUrl(`https://bsplic.vercel.app/not-reset-password#${RECOVERY_HASH}`)).toBeNull();
    expect(parseRecoveryUrl(null)).toBeNull();
  });
});

describe('parseParamString', () => {
  it('decodes percent and plus encoding and keeps the first duplicate', () => {
    expect(parseParamString('a=1%2F2&b=x+y&a=3&flag')).toEqual({ a: '1/2', b: 'x y', flag: '' });
  });
});

describe('readJwtSubject', () => {
  // Payload: {"sub":"4f9c2b1e-7a3d-4c55-9e1f-0b2a6d8c3e71","role":"authenticated","exp":1800000000,"n":"żółć?>"}
  const PAYLOAD =
    'eyJzdWIiOiI0ZjljMmIxZS03YTNkLTRjNTUtOWUxZi0wYjJhNmQ4YzNlNzEiLCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImV4cCI6MTgwMDAwMDAwMCwibiI6IsW8w7PFgsSHPz4ifQ';

  it('reads the user id from an unpadded base64url payload', () => {
    expect(readJwtSubject(`eyJhbGciOiJIUzI1NiJ9.${PAYLOAD}.signature`)).toBe('4f9c2b1e-7a3d-4c55-9e1f-0b2a6d8c3e71');
  });

  it('returns null for tokens it cannot read', () => {
    expect(readJwtSubject('not-a-jwt')).toBeNull();
    expect(readJwtSubject('a.%%%.c')).toBeNull();
  });
});
