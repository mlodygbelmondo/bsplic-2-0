import { randomUUID } from 'crypto';

import { createClient } from '@supabase/supabase-js';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';

import {
  calculateAssetCreditQuantity,
  calculateLegOutcome,
  type CouponSettlementSnapshot,
} from '@/features/admin/settlement';
import type { Database } from '@/integrations/supabase/types';

const TEST_SUPABASE_URL = process.env.TEST_SUPABASE_URL;
const TEST_SUPABASE_ANON_KEY = process.env.TEST_SUPABASE_ANON_KEY;
const TEST_SUPABASE_SERVICE_ROLE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
const hasProcessEnv = typeof process !== 'undefined' && Boolean(process.env);

const hasIntegrationEnv = hasProcessEnv && Boolean(
  TEST_SUPABASE_URL && TEST_SUPABASE_ANON_KEY && TEST_SUPABASE_SERVICE_ROLE_KEY,
);

const describeIfIntegration = hasIntegrationEnv ? describe : describe.skip;

describeIfIntegration('asset stake placement + settlement integration', () => {
  const suffix = randomUUID().slice(0, 8);
  const bettorEmail = `asset-bettor-${suffix}@bsplic.test`;
  const adminEmail = `asset-admin-${suffix}@bsplic.test`;
  const sharedPassword = `Pass-${suffix}-A1!`;

  let service: ReturnType<typeof createClient<Database>>;
  let bettorClient: ReturnType<typeof createClient<Database>>;
  let adminClient: ReturnType<typeof createClient<Database>>;

  let bettorId = '';
  let adminId = '';
  let betId = '';
  let assetId = '';

  beforeAll(async () => {
    service = createClient<Database>(
      TEST_SUPABASE_URL as string,
      TEST_SUPABASE_SERVICE_ROLE_KEY as string,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );

    bettorClient = createClient<Database>(
      TEST_SUPABASE_URL as string,
      TEST_SUPABASE_ANON_KEY as string,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );

    adminClient = createClient<Database>(
      TEST_SUPABASE_URL as string,
      TEST_SUPABASE_ANON_KEY as string,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );

    const createBettor = await service.auth.admin.createUser({
      email: bettorEmail,
      password: sharedPassword,
      email_confirm: true,
      user_metadata: { username: `bettor_${suffix}` },
    });
    if (createBettor.error || !createBettor.data.user?.id) {
      throw new Error(createBettor.error?.message ?? 'Cannot create bettor user');
    }
    bettorId = createBettor.data.user.id;

    const createAdmin = await service.auth.admin.createUser({
      email: adminEmail,
      password: sharedPassword,
      email_confirm: true,
      user_metadata: { username: `admin_${suffix}` },
    });
    if (createAdmin.error || !createAdmin.data.user?.id) {
      throw new Error(createAdmin.error?.message ?? 'Cannot create admin user');
    }
    adminId = createAdmin.data.user.id;

    const { error: roleError } = await service
      .from('user_roles')
      .insert({ user_id: adminId, role: 'admin' });
    if (roleError) {
      throw new Error(roleError.message);
    }

    const { error: profileError } = await service
      .from('profiles')
      .update({ balance: 123.45 })
      .eq('id', bettorId);
    if (profileError) {
      throw new Error(profileError.message);
    }

    const { data: betRow, error: betError } = await service
      .from('bets')
      .insert({
        title: `Asset single test ${suffix}`,
        category_id: null,
        bet_type: '12',
        options: [
          { name: 'UP', odds: 2 },
          { name: 'DOWN', odds: 1.5 },
        ],
        ends_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        is_active: true,
        is_live: false,
      })
      .select('id')
      .single();
    if (betError || !betRow?.id) {
      throw new Error(betError?.message ?? 'Cannot create bet');
    }
    betId = betRow.id;

    const { data: assetRow, error: assetError } = await service
      .from('market_assets')
      .insert({
        symbol: `TASTK${suffix}`.toUpperCase(),
        display_name: `Test Asset Stake ${suffix}`,
        type: 'stock',
        quote_currency: 'PLN',
        min_bet_pln: 1,
        sort_order: 999,
        is_active: true,
      })
      .select('id')
      .single();
    if (assetError || !assetRow?.id) {
      throw new Error(assetError?.message ?? 'Cannot create market asset');
    }
    assetId = assetRow.id;

    const { error: seedPositionError } = await service
      .from('market_transactions')
      .insert({
        user_id: bettorId,
        asset_id: assetId,
        side: 'buy',
        quantity: 10,
        unit_price_pln: 50,
        quote_currency: 'PLN',
        fx_rate_to_pln: 1,
        gross_value_pln: 500,
        fee_pln: 0,
        net_value_pln: 500,
      });
    if (seedPositionError) {
      throw new Error(seedPositionError.message);
    }
  }, 60_000);

  afterAll(async () => {
    if (bettorId) {
      await service.from('market_transactions').delete().eq('user_id', bettorId);
      await service.from('coupons').delete().eq('user_id', bettorId);
      await service.from('placed_bets').delete().eq('user_id', bettorId);
    }

    if (betId) {
      await service.from('bets').delete().eq('id', betId);
    }

    if (assetId) {
      await service.from('market_assets').delete().eq('id', assetId);
    }

    if (adminId) {
      await service.from('user_roles').delete().eq('user_id', adminId);
      await service.auth.admin.deleteUser(adminId);
    }

    if (bettorId) {
      await service.auth.admin.deleteUser(bettorId);
    }
  }, 60_000);

  it('places single coupon with asset stake and settles payout in asset quantity', async () => {
    const beforeProfile = await service
      .from('profiles')
      .select('balance')
      .eq('id', bettorId)
      .single();
    if (beforeProfile.error || !beforeProfile.data) {
      throw new Error(beforeProfile.error?.message ?? 'Cannot read profile before');
    }

    const bettorSignIn = await bettorClient.auth.signInWithPassword({
      email: bettorEmail,
      password: sharedPassword,
    });
    if (bettorSignIn.error) {
      throw new Error(bettorSignIn.error.message);
    }

    const placeResult = await bettorClient.rpc('place_bet_secure', {
      p_user_id: bettorId,
      p_total_odds: 1,
      p_stake: 100,
      p_items: [
        {
          betId,
          selectedOption: 'UP',
          odds: 2,
          stake: 100,
        },
      ],
      p_stake_asset: {
        assetId,
        symbol: `TASTK${suffix}`.toUpperCase(),
        type: 'stock',
        quantity: 2,
        quoteCurrency: 'PLN',
        unitPricePln: 50,
        fxRateToPln: 1,
      },
    });

    expect(placeResult.error).toBeNull();
    expect(placeResult.data).toBeTruthy();
    const couponId = placeResult.data as string;

    const afterProfile = await service
      .from('profiles')
      .select('balance')
      .eq('id', bettorId)
      .single();
    if (afterProfile.error || !afterProfile.data) {
      throw new Error(afterProfile.error?.message ?? 'Cannot read profile after place');
    }

    expect(Number(afterProfile.data.balance)).toBe(Number(beforeProfile.data.balance));

    const couponBeforeResolution = await service
      .from('coupons')
      .select('stake, total_odds, status, payout, stake_asset_quantity')
      .eq('id', couponId)
      .single();
    if (couponBeforeResolution.error || !couponBeforeResolution.data) {
      throw new Error(couponBeforeResolution.error?.message ?? 'Cannot read coupon');
    }

    const stakeTx = await service
      .from('market_transactions')
      .select('id')
      .eq('user_id', bettorId)
      .eq('asset_id', assetId)
      .eq('side', 'bet_stake');
    if (stakeTx.error) {
      throw new Error(stakeTx.error.message);
    }
    expect((stakeTx.data ?? []).length).toBeGreaterThan(0);

    const legRow = await service
      .from('placed_bets')
      .select('id, selected_option, stake, odds_at_time')
      .eq('coupon_id', couponId)
      .single();
    if (legRow.error || !legRow.data) {
      throw new Error(legRow.error?.message ?? 'Cannot read placed leg');
    }

    const legOutcome = calculateLegOutcome({
      selectedOption: legRow.data.selected_option,
      winningOption: 'UP',
      stake: Number(legRow.data.stake),
      oddsAtTime: Number(legRow.data.odds_at_time),
    });

    const updateLeg = await service
      .from('placed_bets')
      .update({ result: legOutcome.result, payout: legOutcome.payout })
      .eq('id', legRow.data.id);
    if (updateLeg.error) {
      throw new Error(updateLeg.error.message);
    }

    const couponAfterResolution = await service
      .from('coupons')
      .select('stake, total_odds, status, payout, stake_asset_quantity')
      .eq('id', couponId)
      .single();
    if (couponAfterResolution.error || !couponAfterResolution.data) {
      throw new Error(couponAfterResolution.error?.message ?? 'Cannot read resolved coupon');
    }

    const couponBefore: CouponSettlementSnapshot = {
      stake: Number(couponBeforeResolution.data.stake),
      totalOdds: Number(couponBeforeResolution.data.total_odds),
      status: couponBeforeResolution.data.status === 'won' || couponBeforeResolution.data.status === 'lost'
        ? couponBeforeResolution.data.status
        : 'pending',
      payout: Number(couponBeforeResolution.data.payout ?? 0),
    };

    const couponAfter: CouponSettlementSnapshot = {
      stake: Number(couponAfterResolution.data.stake),
      totalOdds: Number(couponAfterResolution.data.total_odds),
      status: couponAfterResolution.data.status === 'won' || couponAfterResolution.data.status === 'lost'
        ? couponAfterResolution.data.status
        : 'pending',
      payout: Number(couponAfterResolution.data.payout ?? 0),
    };

    const creditQuantity = calculateAssetCreditQuantity({
      legWon: legOutcome.won,
      oddsAtTime: Number(legRow.data.odds_at_time),
      couponBefore,
      couponAfter,
      stakeAssetQuantity: Number(couponAfterResolution.data.stake_asset_quantity ?? 0),
    });

    expect(creditQuantity).toBe(4);

    const adminSignIn = await adminClient.auth.signInWithPassword({
      email: adminEmail,
      password: sharedPassword,
    });
    if (adminSignIn.error) {
      throw new Error(adminSignIn.error.message);
    }

    const creditResult = await adminClient.rpc('admin_credit_market_asset', {
      p_user_id: bettorId,
      p_asset_id: assetId,
      p_quantity: creditQuantity,
      p_unit_price_pln: 50,
    });

    expect(creditResult.error).toBeNull();

    const finalQty = await service.rpc('get_market_asset_position_qty', {
      p_user_id: bettorId,
      p_asset_id: assetId,
    });
    if (finalQty.error) {
      throw new Error(finalQty.error.message);
    }

    expect(Number(finalQty.data)).toBeCloseTo(12, 8);
  }, 60_000);
});
