/**
 * Which profile a route shows (web `ProfilePage` target resolution): no ref or
 * the viewer's own id is the own profile; a UUID is used as-is; anything else
 * is a username to look up.
 */
export type ProfileRef =
  | { kind: 'own' }
  | { kind: 'id'; userId: string }
  | { kind: 'username'; username: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseProfileRef(ref: string | undefined, currentUserId: string | null): ProfileRef {
  if (!ref || ref === currentUserId) return { kind: 'own' };
  if (UUID_PATTERN.test(ref)) return { kind: 'id', userId: ref };
  return { kind: 'username', username: ref };
}
