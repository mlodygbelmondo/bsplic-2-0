import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

function parseDotEnvFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const map = {};

    content.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;

      const separator = trimmed.indexOf('=');
      if (separator === -1) return;

      const key = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();

      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      map[key] = value;
    });

    return map;
  } catch {
    return {};
  }
}

const dotenvFallback = {
  ...parseDotEnvFile('.env'),
  ...parseDotEnvFile('.env.local'),
};

function readRequiredEnv(name) {
  const value = process.env[name] ?? dotenvFallback[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function readOptionalEnv(name, fallbackValue) {
  return process.env[name] ?? dotenvFallback[name] ?? fallbackValue;
}

function toPositiveInteger(value, defaultValue) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return defaultValue;
  return parsed;
}

async function listAllUsers(supabase) {
  const users = [];
  const perPage = 200;

  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Failed to list users: ${error.message}`);
    }

    const chunk = data?.users ?? [];
    users.push(...chunk);

    if (chunk.length < perPage) {
      break;
    }
  }

  return users;
}

function buildTargetAccounts({ prefix, domain, count }) {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    return {
      email: `${prefix}${number}@${domain}`.toLowerCase(),
      username: `${prefix}${number}`.toLowerCase(),
    };
  });
}

async function run() {
  const url = readRequiredEnv('VITE_SUPABASE_URL');
  const serviceRoleKey = readRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const password = readRequiredEnv('SEED_TEST_PASSWORD');

  const emailPrefix = readOptionalEnv('SEED_TEST_EMAIL_PREFIX', 'testuser');
  const emailDomain = readOptionalEnv('SEED_TEST_EMAIL_DOMAIN', 'bsplic.dev');
  const usersCount = toPositiveInteger(readOptionalEnv('SEED_TEST_USERS_COUNT', '4'), 4);
  const defaultBalance = Number(readOptionalEnv('SEED_TEST_BALANCE', '1000'));

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const existingUsers = await listAllUsers(supabase);
  const existingByEmail = new Map(
    existingUsers
      .filter((user) => Boolean(user.email))
      .map((user) => [String(user.email).toLowerCase(), user])
  );

  const targets = buildTargetAccounts({
    prefix: emailPrefix,
    domain: emailDomain,
    count: usersCount,
  });

  const created = [];
  const updated = [];

  for (const target of targets) {
    const existing = existingByEmail.get(target.email);
    let userId;

    if (existing) {
      const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        user_metadata: {
          username: target.username,
        },
      });

      if (error) {
        throw new Error(`Failed to update ${target.email}: ${error.message}`);
      }

      userId = data.user.id;
      updated.push(target.email);
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: target.email,
        password,
        email_confirm: true,
        user_metadata: {
          username: target.username,
        },
      });

      if (error) {
        throw new Error(`Failed to create ${target.email}: ${error.message}`);
      }

      userId = data.user.id;
      created.push(target.email);
    }

    if (Number.isFinite(defaultBalance) && defaultBalance >= 0) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          username: target.username,
          balance: defaultBalance,
        })
        .eq('id', userId);

      if (profileError) {
        throw new Error(`Failed to update profile for ${target.email}: ${profileError.message}`);
      }
    }
  }

  console.log('Seed completed: test accounts are ready.');
  console.log(`Created: ${created.length} | Updated: ${updated.length}`);
  targets.forEach((target) => {
    console.log(` - ${target.email}`);
  });
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
