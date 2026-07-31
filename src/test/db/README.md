# Behavioral SQL contract tests

These suites call the money-moving RPCs (`create_money_transfer`,
`buy_daily_jackpot_ticket`, `private.finalize_daily_jackpot_pool`,
`preview_global_season_reset`, …) against a **local Supabase stack**, crossing
the same seam the app crosses. They complement the `*Migration.test.ts` files,
which only regex the migration source text.

## Setup (one time)

1. Make sure Docker is available in this shell
   (on WSL: Docker Desktop → Settings → Resources → WSL integration).
2. Start the local stack — this applies every migration in
   `supabase/migrations/`, including the newest ones:

   ```bash
   npx supabase start
   ```

3. Export the connection env (values come from `npx supabase status`):

   ```bash
   export SUPABASE_TEST_URL="http://127.0.0.1:54321"
    export SUPABASE_TEST_ANON_KEY="<anon key>"
    export SUPABASE_TEST_SERVICE_ROLE_KEY="<service_role key>"
    export SUPABASE_TEST_DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
    export SUPABASE_TEST_ALLOW_DESTRUCTIVE="local"
   ```

## Run

```bash
npm run test:db
```

The command fails before collection unless every variable is present, both
URLs use a loopback host, and the destructive-test acknowledgement is set.
The regular `npm test` run excludes this directory and never needs Docker.

## Conventions

- Tests create their own throwaway auth users (`*@bsplic.test`) and delete
  them afterwards; the profile row appears via the `on_auth_user_created`
  trigger with the default 500 balance.
- Direct SQL (the `pg` pool) is reserved for what no interface exposes:
  backdating `auth.users.created_at` for the 14-day rule, forcing a pool's
  `draw_scheduled_at` into the past, and reading verification state.
  Everything under test goes through the RPC interface.
- The jackpot suite refuses to run when current or next-day pools already
  exist, then removes the pools it creates. Reset the local database first if
  its clean-pool preflight fails.
- Prefer `npx supabase db reset` when a previous run left state you don't
  want (e.g. the jackpot suite rolls over today's pool).
