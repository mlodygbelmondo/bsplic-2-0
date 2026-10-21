import { describe, expect, it } from 'vitest';

import { parseProfileRef } from './profileTarget';

const ME = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';

describe('parseProfileRef', () => {
  it('shows the own profile without a ref or for the viewer id', () => {
    expect(parseProfileRef(undefined, ME)).toEqual({ kind: 'own' });
    expect(parseProfileRef(ME, ME)).toEqual({ kind: 'own' });
  });

  it('uses other UUIDs directly, case-insensitively', () => {
    const other = 'A1B2C3D4-E5F6-4A7B-9C8D-0E1F2A3B4C5D';
    expect(parseProfileRef(other, ME)).toEqual({ kind: 'id', userId: other });
  });

  it('treats anything that is not a v1-v5 UUID as a username', () => {
    expect(parseProfileRef('tester', ME)).toEqual({ kind: 'username', username: 'tester' });
    // Variant nibble outside [89ab] fails the web regex.
    const notUuid = '6f1c2a3b-4d5e-4f60-ca7b-9c0d1e2f3a4b';
    expect(parseProfileRef(notUuid, ME)).toEqual({ kind: 'username', username: notUuid });
  });
});
