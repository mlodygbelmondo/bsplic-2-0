/**
 * Parses the password-recovery redirect Supabase sends to
 * `https://bsplic.vercel.app/reset-password`:
 * - implicit flow: `#access_token=…&refresh_token=…&type=recovery`
 * - PKCE flow: `?code=…`
 * - failures (expired/used link): `error_description` in the hash or query.
 */

export type RecoveryLink =
  | { kind: 'tokens'; accessToken: string; refreshToken: string }
  | { kind: 'code'; code: string }
  | { kind: 'error'; message: string }
  | { kind: 'none' };

export type QueryParams = Record<string, string | string[] | undefined>;

function decodeComponent(value: string): string {
  const spaced = value.replace(/\+/g, ' ');
  try {
    return decodeURIComponent(spaced);
  } catch {
    return spaced;
  }
}

/** `a=1&b=2` → `{ a: '1', b: '2' }` (form-encoded, first value wins). */
export function parseParamString(input: string): Record<string, string> {
  const result: Record<string, string> = {};
  const trimmed = input.replace(/^[#?]/, '');
  if (!trimmed) return result;
  for (const pair of trimmed.split('&')) {
    if (!pair) continue;
    const separator = pair.indexOf('=');
    const key = decodeComponent(separator === -1 ? pair : pair.slice(0, separator));
    const value = separator === -1 ? '' : decodeComponent(pair.slice(separator + 1));
    if (key && !(key in result)) result[key] = value;
  }
  return result;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseRecoveryLink({ hash, query = {} }: { hash?: string | null; query?: QueryParams }): RecoveryLink {
  const hashParams = parseParamString(hash ?? '');
  const errorDescription = hashParams.error_description || firstValue(query.error_description);
  if (errorDescription) {
    return { kind: 'error', message: errorDescription };
  }

  const accessToken = hashParams.access_token;
  const refreshToken = hashParams.refresh_token;
  if (accessToken && refreshToken && hashParams.type === 'recovery') {
    return { kind: 'tokens', accessToken, refreshToken };
  }

  const code = firstValue(query.code);
  if (code) {
    return { kind: 'code', code };
  }

  return { kind: 'none' };
}

/**
 * Splits a full incoming URL (universal link or `bsplic://`) into its parts
 * when it points at the reset-password route; `null` otherwise.
 */
export function parseRecoveryUrl(url: string | null | undefined): RecoveryLink | null {
  if (!url) return null;
  const hashIndex = url.indexOf('#');
  const beforeHash = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const hash = hashIndex === -1 ? '' : url.slice(hashIndex + 1);
  const queryIndex = beforeHash.indexOf('?');
  const path = queryIndex === -1 ? beforeHash : beforeHash.slice(0, queryIndex);
  if (!/(^|[/:])reset-password\/?$/.test(path)) return null;
  const query = queryIndex === -1 ? {} : parseParamString(beforeHash.slice(queryIndex + 1));
  return parseRecoveryLink({ hash, query });
}

/** Stable identity for a link, so the same tokens are exchanged only once. */
export function recoveryLinkKey(link: RecoveryLink): string {
  switch (link.kind) {
    case 'tokens':
      return `tokens:${link.refreshToken}`;
    case 'code':
      return `code:${link.code}`;
    case 'error':
      return `error:${link.message}`;
    default:
      return 'none';
  }
}

/** The `sub` (user id) claim of a JWT, or null when it cannot be read. */
export function readJwtSubject(token: string): string | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const claims: unknown = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
    const sub = claims && typeof claims === 'object' ? (claims as { sub?: unknown }).sub : undefined;
    return typeof sub === 'string' ? sub : null;
  } catch {
    return null;
  }
}
