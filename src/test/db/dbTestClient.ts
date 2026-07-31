import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Pool } from 'pg';

/**
 * Connection helpers for behavioral SQL contract tests.
 *
 * These tests execute the real RPCs against a LOCAL Supabase stack
 * (`supabase start`), crossing the same seam the app does. They are gated on
 * the env below. The dedicated DB command fails fast when they are absent or
 * do not point at loopback, while the regular `npm test` run excludes this
 * directory and never needs Docker.
 *
 * Copy the values from `supabase status` (or `supabase status -o env`):
 *   SUPABASE_TEST_URL              — API URL, e.g. http://127.0.0.1:54321
 *   SUPABASE_TEST_ANON_KEY         — anon key
 *   SUPABASE_TEST_SERVICE_ROLE_KEY — service_role key
 *   SUPABASE_TEST_DB_URL           — DB URL, e.g.
 *                                    postgresql://postgres:postgres@127.0.0.1:54322/postgres
 *   SUPABASE_TEST_ALLOW_DESTRUCTIVE — must be exactly `local`
 */
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. See src/test/db/README.md before running test:db.`,
    );
  }
  return value;
}

function requireLoopbackUrl(name: string, value: string): string {
  let hostname: string;
  try {
    hostname = new URL(value).hostname;
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }

  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error(
      `${name} must point at localhost; refusing destructive DB tests against ${hostname}`,
    );
  }
  return value;
}

if (process.env.SUPABASE_TEST_ALLOW_DESTRUCTIVE !== 'local') {
  throw new Error(
    'Set SUPABASE_TEST_ALLOW_DESTRUCTIVE=local to acknowledge that test:db mutates the local stack.',
  );
}

export const dbTestEnv = {
  url: requireLoopbackUrl('SUPABASE_TEST_URL', requireEnv('SUPABASE_TEST_URL')),
  anonKey: requireEnv('SUPABASE_TEST_ANON_KEY'),
  serviceRoleKey: requireEnv('SUPABASE_TEST_SERVICE_ROLE_KEY'),
  dbUrl: requireLoopbackUrl(
    'SUPABASE_TEST_DB_URL',
    requireEnv('SUPABASE_TEST_DB_URL'),
  ),
};

export function createServiceClient(): SupabaseClient {
  return createClient(dbTestEnv.url, dbTestEnv.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createDbPool(): Pool {
  return new Pool({ connectionString: dbTestEnv.dbUrl, max: 2 });
}

export interface TestUser {
  id: string;
  email: string;
  client: SupabaseClient;
}

/** Creates a confirmed auth user (profile row appears via trigger) and returns
 * an authenticated client for them. */
export async function createTestUser(
  service: SupabaseClient,
  usernamePrefix: string,
): Promise<TestUser> {
  const unique = `${usernamePrefix}-${Math.random().toString(36).slice(2, 10)}`;
  const email = `${unique}@bsplic.test`;
  const password = `pw-${unique}-A1!`;

  const { data: created, error: createError } =
    await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username: unique },
    });
  if (createError || !created.user) {
    throw new Error(`createUser failed: ${createError?.message}`);
  }

  const client = createClient(dbTestEnv.url, dbTestEnv.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) {
    throw new Error(`signIn failed: ${signInError.message}`);
  }

  return { id: created.user.id, email, client };
}

/** The 14-day transfer rule uses auth.users.created_at; tests backdate it
 * through the DB seam because no API exposes it. */
export async function backdateAccount(
  pool: Pool,
  userId: string,
  days: number,
): Promise<void> {
  await pool.query(
    `UPDATE auth.users SET created_at = NOW() - make_interval(days => $2) WHERE id = $1`,
    [userId, days],
  );
}

export async function getProfileBalance(
  pool: Pool,
  userId: string,
): Promise<number> {
  const { rows } = await pool.query(
    `SELECT balance::float8 AS balance FROM public.profiles WHERE id = $1`,
    [userId],
  );
  return rows[0]?.balance;
}

export async function deleteTestUsers(
  service: SupabaseClient,
  users: TestUser[],
): Promise<void> {
  for (const user of users) {
    const { error } = await service.auth.admin.deleteUser(user.id);
    if (error) {
      throw new Error(`deleteUser failed for ${user.email}: ${error.message}`);
    }
  }
}
