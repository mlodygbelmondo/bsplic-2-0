import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationsDir = join(process.cwd(), 'supabase/migrations');
const migrationFiles = readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort();
const migrationSqlByFile = new Map(
  migrationFiles.map((file) => [
    file,
    readFileSync(join(migrationsDir, file), 'utf8'),
  ]),
);
const migrationSql = migrationFiles
  .map((file) => migrationSqlByFile.get(file) ?? '')
  .join('\n');

function getFunctionBody(functionName: string): string {
  const pattern = new RegExp(
    `CREATE OR REPLACE FUNCTION ${functionName}[\\s\\S]*?\\nEND;\\n\\$\\$;`,
    'gm',
  );
  const matches = Array.from(migrationSql.matchAll(pattern), (match) => match[0]);
  return matches.at(-1) ?? '';
}

describe('daily jackpot migration security invariants', () => {
  it('does not expose date-selected jackpot finalization to authenticated users', () => {
    const fundingMaintenanceMigration =
      migrationSqlByFile.get(
        '20260622011000_harden_jackpot_funding_maintenance_contract.sql',
      ) ?? '';

    expect(fundingMaintenanceMigration).toContain(
      'REVOKE EXECUTE ON FUNCTION public.finalize_daily_jackpot_if_due(DATE)',
    );
    expect(fundingMaintenanceMigration).toContain(
      'DROP FUNCTION IF EXISTS public.finalize_daily_jackpot_if_due(DATE)',
    );
  });

  it('keeps the user-facing jackpot state RPC authoritative without relying only on cron', () => {
    const body = getFunctionBody('public.get_daily_jackpot_state\\(\\)');

    expect(body).toContain('private.sync_daily_jackpot_funding(v_today)');
    expect(body).toContain('private.finalize_daily_jackpot_pool');
    expect(body).toContain('draw_scheduled_at <= NOW()');
    expect(body).not.toContain('INSERT INTO');
    expect(body).not.toContain('UPDATE public');
  });

  it('reconciles stale lost-coupon funding entries before recalculating the pool', () => {
    const body = getFunctionBody(
      'private.sync_daily_jackpot_funding\\(p_pool_date DATE\\)',
    );

    expect(body).toContain('private.get_active_season_started_at()');
    expect(body).toContain('DELETE FROM public.daily_jackpot_funding_entries');
    expect(body).toContain("f.source_type = 'lost_coupon'");
    expect(body).toContain('NOT EXISTS');
    expect(body).toContain('COALESCE(c.settled_at, c.created_at) >= v_season_started_at');
  });

  it('ships a cleanup for cancelled active-season jackpot pools after global reset', () => {
    const cleanupMigration = Array.from(migrationSqlByFile.entries()).find(
      ([file]) => file.endsWith('_cleanup_cancelled_active_jackpot.sql'),
    )?.[1] ?? '';

    expect(cleanupMigration).toContain('v_today DATE := (timezone(\'Europe/Warsaw\', NOW()))::DATE');
    expect(cleanupMigration).toContain('DELETE FROM public.daily_jackpot_funding_entries');
    expect(cleanupMigration).toContain('DELETE FROM public.daily_jackpot_tickets');
    expect(cleanupMigration).toContain('DELETE FROM public.daily_jackpot_events');
    expect(cleanupMigration).toContain("status = 'collecting'");
    expect(cleanupMigration).toContain('prize_amount = 0');
    expect(cleanupMigration).toContain("status = 'cancelled'");
    expect(cleanupMigration).toContain('draw_scheduled_at > NOW()');
  });

  it('uses range-friendly indexes for lost coupon funding sync', () => {
    expect(migrationSql).toContain(
      'daily_jackpot_coupons_lost_settled_idx',
    );
    expect(migrationSql).toContain(
      'daily_jackpot_coupons_lost_created_idx',
    );
  });

  it('funds jackpot from 20 percent of lost coupons and ticket purchases', () => {
    const fundingMaintenanceMigration =
      migrationSqlByFile.get(
        '20260622011000_harden_jackpot_funding_maintenance_contract.sql',
      ) ?? '';
    const ticketContractMigration =
      migrationSqlByFile.get('20260619030000_harden_daily_jackpot_ticket_contract.sql') ?? '';
    const fundingBody = getFunctionBody(
      'private.sync_daily_jackpot_funding\\(p_pool_date DATE\\)',
    );
    const purchaseBody = getFunctionBody(
      'public.buy_daily_jackpot_ticket\\(p_pool_id UUID\\)',
    );

    expect(fundingMaintenanceMigration).toContain("WHERE source_type = 'ticket_fee'");
    expect(migrationSql).toContain(
      "CHECK (source_type IN ('lost_coupon', 'rollover', 'ticket_purchase'))",
    );
    expect(migrationSql).toContain('daily_jackpot_funding_ticket_purchase_unique');
    expect(fundingBody).toContain('ROUND(c.stake * 0.20, 2)');
    expect(purchaseBody).toContain("v_ticket_funding_source_type TEXT := 'ticket_purchase'");
    expect(purchaseBody).toContain('v_ticket_id');
    expect(purchaseBody).toContain('ROUND(v_pool.ticket_price, 2)');
    expect(ticketContractMigration).toContain(
      'ALTER COLUMN ticket_price SET DEFAULT 100',
    );
    expect(migrationSql).toContain("'ticket_price', 100");
  });

  it('allows the first ticket purchase to seed a zero-prize collecting pool', () => {
    const body = getFunctionBody(
      'public.buy_daily_jackpot_ticket\\(p_pool_id UUID\\)',
    );

    expect(body).not.toContain('v_pool.prize_amount <= 0');
    expect(body).toContain("v_ticket_funding_source_type TEXT := 'ticket_purchase'");
  });

  it('excludes refunded ticket purchase funding from insufficient-player rollover', () => {
    const body = getFunctionBody(
      'private.finalize_daily_jackpot_pool\\(\\s*p_pool_date DATE,\\s*p_snapshot_user_id UUID DEFAULT NULL\\s*\\)',
    );

    expect(body).toContain('v_rollover_amount');
    expect(body).toContain("source_type <> 'ticket_purchase'");
    expect(body).toContain('ROUND(v_rollover_amount, 2)');
    expect(body).not.toContain('ROUND(v_pool.prize_amount, 2)');
  });

  it('publishes the per-player ticket limit in jackpot snapshots', () => {
    const fundedBody = getFunctionBody(
      'private.get_daily_jackpot_snapshot\\(\\s*p_pool_id UUID,\\s*p_user_id UUID\\s*\\)',
    );
    const emptyBody = getFunctionBody(
      'private.get_empty_daily_jackpot_snapshot\\(p_pool_date DATE\\)',
    );

    expect(fundedBody).toContain("'max_tickets_per_player', 2");
    expect(emptyBody).toContain("'max_tickets_per_player', 2");
  });

  it('publishes all current user ticket numbers in jackpot snapshots', () => {
    const ticketNumbersMigration =
      migrationSqlByFile.get('20260621031500_daily_jackpot_user_ticket_numbers.sql') ??
      '';
    const fundedBody = getFunctionBody(
      'private.get_daily_jackpot_snapshot\\(\\s*p_pool_id UUID,\\s*p_user_id UUID\\s*\\)',
    );

    expect(fundedBody).toContain("'current_user_ticket_numbers', COALESCE((");
    expect(fundedBody).toContain(
      'jsonb_agg(t.ticket_number ORDER BY t.ticket_number)',
    );
    expect(ticketNumbersMigration).toContain(
      "'current_user_ticket_numbers', '[]'::jsonb",
    );
  });

  it('keeps winner details out of user-facing jackpot state snapshots', () => {
    const fundedBody = getFunctionBody(
      'private.get_daily_jackpot_snapshot\\(\\s*p_pool_id UUID,\\s*p_user_id UUID\\s*\\)',
    );
    const revealBody = getFunctionBody(
      'public.reveal_daily_jackpot_draw\\(p_pool_id UUID\\)',
    );

    expect(fundedBody).toContain("'winner_user_id', NULL");
    expect(fundedBody).toContain("'winner_username', NULL");
    expect(fundedBody).toContain("'winner_avatar_url', NULL");
    expect(fundedBody).toContain("'winning_ticket_number', NULL");
    expect(fundedBody).not.toContain("'winner_user_id', p.winner_user_id");
    expect(fundedBody).not.toContain(
      "'winning_ticket_number', winning_ticket.ticket_number",
    );
    expect(revealBody).toContain("'winner_user_id', v_pool.winner_user_id");
    expect(revealBody).toContain(
      "'winning_ticket_number', v_winning_ticket_number",
    );
  });

  it('replaces broad jackpot pool reads with admin-only direct table access', () => {
    const hardeningMigration =
      migrationSqlByFile.get(
        '20260621043000_harden_daily_jackpot_reveal_boundary.sql',
      ) ?? '';

    expect(hardeningMigration).toContain(
      'DROP POLICY IF EXISTS "Authenticated users can read jackpot pools"',
    );
    expect(hardeningMigration).toContain(
      'CREATE POLICY "Admins can read jackpot pools"',
    );
    expect(hardeningMigration).toContain(
      "public.has_role((SELECT auth.uid()), 'admin')",
    );
    expect(hardeningMigration).not.toContain('USING (true)');
  });

  it('reports state maintenance reward auto-credits to clients', () => {
    const fundedBody = getFunctionBody(
      'private.get_daily_jackpot_snapshot\\(\\s*p_pool_id UUID,\\s*p_user_id UUID\\s*\\)',
    );
    const emptyBody = getFunctionBody(
      'private.get_empty_daily_jackpot_snapshot\\(p_pool_date DATE\\)',
    );
    const stateBody = getFunctionBody('public.get_daily_jackpot_state\\(\\)');

    expect(fundedBody).toContain("'maintenance_auto_credited_count'");
    expect(emptyBody).toContain("'maintenance_auto_credited_count', 0");
    expect(stateBody).toContain('v_auto_credited_count');
    expect(stateBody).toContain(
      "jsonb_set(v_snapshot, '{maintenance_auto_credited_count}'",
    );
  });

  it('limits jackpot tickets to two per player in the purchase RPC', () => {
    const body = getFunctionBody(
      'public.buy_daily_jackpot_ticket\\(p_pool_id UUID\\)',
    );

    expect(body).toContain('v_user_ticket_count');
    expect(body).toContain('IF v_user_ticket_count >= 2 THEN');
  });

  it('ships post-deploy ticket contract fixes in a fresh migration', () => {
    const contractMigration =
      migrationSqlByFile.get('20260619030000_harden_daily_jackpot_ticket_contract.sql') ?? '';

    expect(contractMigration).toContain(
      'ALTER COLUMN ticket_price SET DEFAULT 100',
    );
    expect(contractMigration).toContain(
      'DROP CONSTRAINT IF EXISTS daily_jackpot_tickets_pool_id_user_id_key',
    );
    expect(contractMigration).toContain('IF v_user_ticket_count >= 2 THEN');
    expect(contractMigration).toContain('ROUND(v_pool.ticket_price, 2)');
  });

  it('does not credit the jackpot winner during draw finalization', () => {
    const body = getFunctionBody(
      'private.finalize_daily_jackpot_pool\\(\\s*p_pool_date DATE,\\s*p_snapshot_user_id UUID DEFAULT NULL\\s*\\)',
    );

    expect(body).not.toContain(
      'SET balance = ROUND(balance + v_pool.prize_amount, 2)',
    );
    expect(body).toContain("reward_credit_status = 'pending'");
    expect(body).toContain('public.create_user_notification');
    expect(body).toContain('/jackpot/draw/');
  });

  it('notifies jackpot participants without spoiling the winner', () => {
    const enumMigration =
      migrationSqlByFile.get('20260619024553_add_jackpot_draw_ready_notification_type.sql') ??
      '';
    const rewardMigration =
      migrationSqlByFile.get('20260619024554_jackpot_reward_claim_flow.sql') ??
      '';

    expect(enumMigration).toContain(
      "ADD VALUE IF NOT EXISTS 'jackpot_draw_ready'",
    );
    expect(rewardMigration).not.toContain(
      "ADD VALUE IF NOT EXISTS 'jackpot_draw_ready'",
    );
    expect(migrationSql).toContain(
      'Losowanie jackpotu, w którym bierzesz udział, właśnie się zakończyło. Kliknij, aby obejrzeć wynik.',
    );
    expect(migrationSql).not.toContain('Wygrał jackpot');
  });

  it('notifies participants when a jackpot rolls over without enough players', () => {
    const body = getFunctionBody(
      'private.finalize_daily_jackpot_pool\\(\\s*p_pool_date DATE,\\s*p_snapshot_user_id UUID DEFAULT NULL\\s*\\)',
    );

    expect(body).toContain("'rolled_over'");
    expect(body).toContain('FOR v_participant_user_id IN');
    expect(body).toContain('public.create_user_notification');
    expect(body).toContain('Pula jackpotu przeszła dalej');
    expect(body).toContain("'event', 'rolled_over'");
    expect(migrationSql).toContain('Backfill rollover notifications');
  });

  it('exposes a replay RPC with participants and reward claim state', () => {
    const body = getFunctionBody(
      'public.get_daily_jackpot_draw\\(p_pool_id UUID\\)',
    );

    expect(body).toContain('current_user_is_winner');
    expect(body).toContain('reward_credit_status');
    expect(body).toContain('participants');
    expect(body).toContain('jsonb_agg');
  });

  it('exposes rolled-over participant settlements through the draw route', () => {
    const body = getFunctionBody(
      'public.get_daily_jackpot_draw\\(p_pool_id UUID\\)',
    );
    const stateBody = getFunctionBody('public.get_daily_jackpot_state\\(\\)');

    expect(body).toContain("v_pool.status NOT IN ('drawn', 'rolled_over')");
    expect(body).toContain("IF v_pool.status = 'rolled_over'");
    expect(body).toContain('INSERT INTO public.daily_jackpot_draw_views');
    expect(stateBody).toContain("p.status IN ('drawn', 'rolled_over')");
    expect(stateBody).toContain('v_pending_draw_pool_id');
  });

  it('keeps rolled-over settlement details participant-only', () => {
    const body = getFunctionBody(
      'public.get_daily_jackpot_draw\\(p_pool_id UUID\\)',
    );

    expect(body).toMatch(
      /v_pool\.status\s*=\s*'rolled_over'\s+AND\s+v_current_user_ticket_count\s*=\s*0/i,
    );
    expect(body).toContain('Rozliczenie tej puli jest dostępne tylko dla uczestników');
  });

  it('keeps winner details behind the reveal RPC and claim behind viewed state', () => {
    const metadataBody = getFunctionBody(
      'public.get_daily_jackpot_draw\\(p_pool_id UUID\\)',
    );
    const revealBody = getFunctionBody(
      'public.reveal_daily_jackpot_draw\\(p_pool_id UUID\\)',
    );
    const claimBody = getFunctionBody(
      'public.claim_daily_jackpot_reward\\(p_pool_id UUID\\)',
    );
    const creditBody = getFunctionBody(
      'private.credit_daily_jackpot_reward\\(\\s*p_pool_id UUID,\\s*p_credit_mode TEXT\\s*\\)',
    );

    expect(metadataBody).toContain("'winner_user_id', NULL");
    expect(metadataBody).toContain("'winning_ticket_number', NULL");
    expect(metadataBody).not.toContain("'winner_user_id', v_pool.winner_user_id");
    expect(revealBody).toContain("'winner_user_id', v_pool.winner_user_id");
    expect(revealBody).toContain('result_viewed_at = COALESCE(result_viewed_at, NOW())');
    expect(claimBody).toContain('v_pool.result_viewed_at IS NULL');
    expect(creditBody).not.toContain('result_viewed_at = CASE');
    expect(migrationSql).toContain(
      'REVOKE EXECUTE ON FUNCTION public.mark_daily_jackpot_result_viewed(UUID) FROM PUBLIC, anon, authenticated',
    );
    expect(migrationSql).not.toContain(
      'GRANT EXECUTE ON FUNCTION public.mark_daily_jackpot_result_viewed(UUID) TO authenticated',
    );
  });

  it('ships a post-deploy repair migration for the reveal draw RPC contract', () => {
    const repairMigration = Array.from(migrationSqlByFile.entries()).find(
      ([file]) => file.endsWith('_restore_daily_jackpot_reveal_rpc.sql'),
    )?.[1] ?? '';

    expect(repairMigration).toContain(
      'CREATE OR REPLACE FUNCTION public.reveal_daily_jackpot_draw(p_pool_id UUID)',
    );
    expect(repairMigration).toContain(
      'REVOKE EXECUTE ON FUNCTION public.mark_daily_jackpot_result_viewed(UUID) FROM PUBLIC, anon, authenticated',
    );
    expect(repairMigration).toContain(
      'GRANT EXECUTE ON FUNCTION public.reveal_daily_jackpot_draw(UUID) TO authenticated',
    );
    expect(repairMigration).toContain("NOTIFY pgrst, 'reload schema'");
  });

  it('advances the home jackpot state after a participant viewed the finished draw', () => {
    const handoffMigration = Array.from(migrationSqlByFile.entries()).find(
      ([file]) => file.endsWith('_advance_daily_jackpot_after_viewed_draw.sql'),
    )?.[1] ?? '';
    const stateBody = getFunctionBody('public.get_daily_jackpot_state\\(\\)');
    const revealBody = getFunctionBody(
      'public.reveal_daily_jackpot_draw\\(p_pool_id UUID\\)',
    );

    expect(handoffMigration).toContain(
      'CREATE TABLE IF NOT EXISTS public.daily_jackpot_draw_views',
    );
    expect(handoffMigration).toContain('PRIMARY KEY (pool_id, user_id)');
    expect(handoffMigration).toContain(
      'ALTER TABLE public.daily_jackpot_draw_views ENABLE ROW LEVEL SECURITY',
    );
    expect(handoffMigration).toContain(
      'REVOKE ALL ON TABLE public.daily_jackpot_draw_views FROM PUBLIC, anon, authenticated',
    );
    expect(revealBody).toContain(
      'INSERT INTO public.daily_jackpot_draw_views',
    );
    expect(revealBody).toContain('v_current_user_ticket_count > 0');
    expect(stateBody).toContain('v_pending_draw_pool_id');
    expect(stateBody).toContain('public.daily_jackpot_draw_views viewed');
    expect(stateBody).toContain('v_visible_pool_date := v_today + 1');
    expect(stateBody).toContain(
      'v_pool_id := private.sync_daily_jackpot_funding(v_visible_pool_date)',
    );
  });

  it('claims jackpot rewards transactionally and idempotently', () => {
    const body = getFunctionBody(
      'private.credit_daily_jackpot_reward\\(\\s*p_pool_id UUID,\\s*p_credit_mode TEXT\\s*\\)',
    );

    expect(body).toContain('FOR UPDATE');
    expect(body).toContain("v_pool.reward_credit_status IN ('claimed', 'auto_credited')");
    expect(body).toContain('UPDATE public.profiles');
    expect(body).toContain('reward_credit_event_id');
  });

  it('auto-credits previous unclaimed rewards before the next jackpot is maintained', () => {
    const helperBody = getFunctionBody(
      'private.auto_credit_unclaimed_daily_jackpot_rewards\\(\\s*p_before_date DATE\\s*\\)',
    );
    const stateBody = getFunctionBody('public.get_daily_jackpot_state\\(\\)');
    const maintainBody = getFunctionBody('public.maintain_daily_jackpot\\(\\)');

    expect(helperBody).toContain("reward_credit_status = 'pending'");
    expect(helperBody).toContain('private.credit_daily_jackpot_reward');
    expect(stateBody).toContain(
      'private.auto_credit_unclaimed_daily_jackpot_rewards(v_today)',
    );
    expect(maintainBody).toContain(
      'private.auto_credit_unclaimed_daily_jackpot_rewards(v_today)',
    );
  });

  it('revokes direct execution of private jackpot helpers from public client roles', () => {
    [
      'private.ensure_daily_jackpot_pool(DATE)',
      'private.get_daily_jackpot_snapshot(UUID, UUID)',
      'private.get_empty_daily_jackpot_snapshot(DATE)',
      'private.sync_daily_jackpot_funding(DATE)',
      'private.finalize_daily_jackpot_pool(DATE, UUID)',
      'private.credit_daily_jackpot_reward(UUID, TEXT)',
      'private.auto_credit_unclaimed_daily_jackpot_rewards(DATE)',
    ].forEach((signature) => {
      expect(migrationSql).toContain(
        `REVOKE ALL ON FUNCTION ${signature} FROM PUBLIC, anon, authenticated`,
      );
    });
  });

  it('wraps auth.uid in jackpot RLS policies for row-scan performance', () => {
    expect(migrationSql).toContain(
      'DROP POLICY IF EXISTS "Users can read own jackpot tickets"',
    );
    expect(migrationSql).toContain('(SELECT auth.uid()) = user_id');
    expect(migrationSql).toContain(
      "public.has_role((SELECT auth.uid()), 'admin')",
    );
  });

  it('allows buying the next visible jackpot pool after today is terminal', () => {
    const body = getFunctionBody(
      'public.buy_daily_jackpot_ticket\\(p_pool_id UUID\\)',
    );

    expect(body).toContain(
      "v_current_pool_date DATE := (timezone('Europe/Warsaw', NOW()))::DATE",
    );
    expect(body).toContain('v_allowed_pool_date DATE := v_current_pool_date');
    expect(body).toContain("status IN ('drawn', 'rolled_over', 'cancelled')");
    expect(body).toContain(
      'v_allowed_pool_date := v_current_pool_date + 1',
    );
    expect(body).toContain('IF v_pool.pool_date <> v_allowed_pool_date THEN');
  });

  it('moves corrected lost coupons to the current terminal transition timestamp', () => {
    const body = getFunctionBody('public.resolve_coupon_status\\(\\)');

    expect(body).toContain("status IS DISTINCT FROM 'lost' THEN NOW()");
    expect(body).toContain("status IS DISTINCT FROM 'refund' THEN NOW()");
    expect(body).toContain("status IS DISTINCT FROM 'won' THEN NOW()");
    expect(body).not.toContain('settled_at = COALESCE(settled_at, NOW())');
  });
});
