import { supabase } from '@/integrations/supabase/client';
import { MarketAsset, MarketTransactionRecord } from '@/types/markets';

const ACTIVE_ONLY = true;

function toAsset(row: {
  id: string;
  symbol: string;
  display_name: string;
  type: string;
  quote_currency: string;
  is_active: boolean;
  min_bet_pln: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}): MarketAsset {
  return {
    id: row.id,
    symbol: row.symbol,
    display_name: row.display_name,
    type: row.type as MarketAsset['type'],
    quote_currency: row.quote_currency,
    is_active: row.is_active,
    min_bet_pln: Number(row.min_bet_pln),
    sort_order: Number(row.sort_order),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toTransaction(row: {
  id: string;
  user_id: string;
  asset_id: string;
  side: string;
  quantity: number;
  unit_price_pln: number;
  quote_currency: string;
  fx_rate_to_pln: number;
  gross_value_pln: number;
  fee_pln: number;
  net_value_pln: number;
  created_at: string;
}): MarketTransactionRecord {
  return {
    id: row.id,
    user_id: row.user_id,
    asset_id: row.asset_id,
    side: row.side as MarketTransactionRecord['side'],
    quantity: Number(row.quantity),
    unit_price_pln: Number(row.unit_price_pln),
    quote_currency: row.quote_currency,
    fx_rate_to_pln: Number(row.fx_rate_to_pln),
    gross_value_pln: Number(row.gross_value_pln),
    fee_pln: Number(row.fee_pln),
    net_value_pln: Number(row.net_value_pln),
    created_at: row.created_at,
  };
}

export async function fetchMarketAssets(): Promise<MarketAsset[]> {
  const { data, error } = await supabase
    .from('market_assets')
    .select('*')
    .eq('is_active', ACTIVE_ONLY)
    .order('sort_order')
    .order('display_name');

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => toAsset(row));
}

export async function fetchAllMarketAssetsForAdmin(): Promise<MarketAsset[]> {
  const { data, error } = await supabase
    .from('market_assets')
    .select('*')
    .order('type')
    .order('sort_order')
    .order('display_name');

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => toAsset(row));
}

export async function searchMarketAssetsInCatalog(
  query: string,
  limit = 20
): Promise<MarketAsset[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { data, error } = await supabase.rpc('search_market_assets', {
    p_query: trimmed,
    p_limit: limit,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => toAsset(row));
}

export async function fetchUserMarketTransactions(userId: string): Promise<MarketTransactionRecord[]> {
  const { data, error } = await supabase
    .from('market_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => toTransaction(row));
}

export async function upsertMarketAsset(input: {
  id?: string;
  symbol: string;
  displayName: string;
  type: MarketAsset['type'];
  quoteCurrency: string;
  minBetPln: number;
  sortOrder: number;
  isActive: boolean;
}) {
  const payload = {
    symbol: input.symbol.trim().toUpperCase(),
    display_name: input.displayName.trim(),
    type: input.type,
    quote_currency: input.quoteCurrency.trim().toUpperCase(),
    min_bet_pln: input.minBetPln,
    sort_order: input.sortOrder,
    is_active: input.isActive,
  };

  if (input.id) {
    const { error } = await supabase
      .from('market_assets')
      .update(payload)
      .eq('id', input.id);

    if (error) {
      throw new Error(error.message);
    }

    return;
  }

  const { error } = await supabase.from('market_assets').insert(payload);
  if (error) {
    throw new Error(error.message);
  }
}

export async function placeMarketOrderSecure(params: {
  userId: string;
  assetId: string;
  side: 'buy' | 'sell';
  quantity: number;
  unitPrice: number;
  quoteCurrency: string;
  fxRateToPln: number;
}) {
  const { data, error } = await supabase.rpc('place_market_order_secure', {
    p_user_id: params.userId,
    p_asset_id: params.assetId,
    p_side: params.side,
    p_quantity: params.quantity,
    p_unit_price: params.unitPrice,
    p_quote_currency: params.quoteCurrency,
    p_fx_rate_to_pln: params.fxRateToPln,
  });

  if (error) {
    throw new Error(error.message);
  }

  return Number(data ?? 0);
}

export interface MarketDataCronProfileResult {
  peak_schedule: string;
  offpeak_schedule: string;
  estimated_runs_per_day: number;
}

export async function setupMarketDataRefreshCronProfile(params: {
  projectUrl: string;
  anonKey: string;
  peakStartHour?: number;
  peakEndHour?: number;
  offpeakStepHours?: number;
}): Promise<MarketDataCronProfileResult> {
  const { data, error } = await (supabase as never as {
    rpc: (fn: string, args?: Record<string, unknown>) => Promise<{
      data: MarketDataCronProfileResult[] | null;
      error: { message: string } | null;
    }>;
  }).rpc('setup_market_data_refresh_cron_profile', {
    p_project_url: params.projectUrl,
    p_anon_key: params.anonKey,
    p_peak_start_hour: params.peakStartHour ?? 10,
    p_peak_end_hour: params.peakEndHour ?? 16,
    p_offpeak_step_hours: params.offpeakStepHours ?? 2,
  });

  if (error) {
    if (error.message.includes('Could not find the function public.setup_market_data_refresh_cron_profile')) {
      throw new Error(
        'Brak funkcji setup_market_data_refresh_cron_profile w bazie. Uruchom migracje Supabase (w tym 20260318113000_asset_stake_social_and_cron_profile.sql), a potem odswiez schema cache PostgREST.'
      );
    }

    throw new Error(error.message);
  }

  const first = data?.[0];
  if (!first) {
    throw new Error('Nie udało się skonfigurować harmonogramu odświeżania');
  }

  return first;
}

export async function disableMarketDataRefreshCron(): Promise<void> {
  const { error } = await (supabase as never as {
    rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  }).rpc('disable_market_data_refresh_cron');

  if (error) {
    throw new Error(error.message);
  }
}
