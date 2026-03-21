// deno-lint-ignore-file no-explicit-any
// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TWELVE_DATA_BASE_URL = 'https://api.twelvedata.com';

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

function normalizeSymbol(symbol: string): string {
  return String(symbol ?? '').trim().toUpperCase();
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIso(payload: Record<string, unknown>): string {
  const timestamp = payload.timestamp;
  if (typeof timestamp === 'number' && Number.isFinite(timestamp)) {
    return new Date(timestamp * 1000).toISOString();
  }

  const datetime = payload.datetime;
  if (typeof datetime === 'string') {
    const date = new Date(datetime);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return new Date().toISOString();
}

function parseQuotePayload(payload: Record<string, unknown>, fallbackSymbol: string) {
  if (payload.code || payload.status === 'error') {
    return null;
  }

  const close = toNumber(payload.close as string | number | null | undefined);
  if (!close || close <= 0) return null;

  const symbol = normalizeSymbol((payload.symbol as string | undefined) ?? fallbackSymbol);
  if (!symbol) return null;

  return {
    symbol,
    quoteCurrency: normalizeSymbol((payload.currency as string | undefined) ?? 'USD') || 'USD',
    price: close,
    open: toNumber(payload.open as string | number | null | undefined),
    high: toNumber(payload.high as string | number | null | undefined),
    low: toNumber(payload.low as string | number | null | undefined),
    volume: toNumber(payload.volume as string | number | null | undefined),
    asOf: toIso(payload),
    provider: 'twelvedata',
  };
}

function normalizeQuotesResponse(payload: unknown, requestedSymbols: string[]) {
  const quotesBySymbol: Record<string, ReturnType<typeof parseQuotePayload>> = {};

  if (Array.isArray(payload)) {
    payload.forEach((row, index) => {
      if (!row || typeof row !== 'object') return;
      const quote = parseQuotePayload(row as Record<string, unknown>, requestedSymbols[index] ?? '');
      if (!quote) return;
      quotesBySymbol[quote.symbol] = quote;
    });
    return quotesBySymbol;
  }

  if (payload && typeof payload === 'object' && ('symbol' in payload || 'close' in payload || 'code' in payload)) {
    const quote = parseQuotePayload(payload as Record<string, unknown>, requestedSymbols[0] ?? '');
    if (quote) {
      quotesBySymbol[quote.symbol] = quote;
    }
    return quotesBySymbol;
  }

  if (payload && typeof payload === 'object') {
    Object.entries(payload as Record<string, unknown>).forEach(([symbol, row]) => {
      if (!row || typeof row !== 'object') return;
      const quote = parseQuotePayload(row as Record<string, unknown>, symbol);
      if (!quote) return;
      quotesBySymbol[quote.symbol] = quote;
    });
  }

  return quotesBySymbol;
}

function mapInstrumentType(rawType: unknown): string | null {
  const normalized = String(rawType ?? '').toLowerCase();
  if (normalized.includes('etf')) return 'etf';
  if (normalized.includes('crypto')) return 'crypto';
  if (normalized.includes('forex')) return 'forex';
  if (normalized.includes('commodity')) return 'commodity';
  if (normalized.includes('stock')) return 'stock';
  return null;
}

async function fetchQuoteBatch(symbols: string[]) {
  if (symbols.length === 0) return {} as Record<string, ReturnType<typeof parseQuotePayload>>;

  const apiKey = getRequiredEnv('TWELVEDATA_API_KEY');
  const url = new URL(`${TWELVE_DATA_BASE_URL}/quote`);
  url.searchParams.set('symbol', symbols.join(','));
  url.searchParams.set('apikey', apiKey);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`TwelveData quote error: ${response.status}`);
  }

  const payload = await response.json();
  return normalizeQuotesResponse(payload, symbols);
}

async function fetchSearch(query: string) {
  const apiKey = getRequiredEnv('TWELVEDATA_API_KEY');
  const url = new URL(`${TWELVE_DATA_BASE_URL}/symbol_search`);
  url.searchParams.set('symbol', query);
  url.searchParams.set('apikey', apiKey);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`TwelveData search error: ${response.status}`);
  }

  const payload = (await response.json()) as { data?: Array<Record<string, unknown>>; code?: number; status?: string };
  if (payload.code || payload.status === 'error') {
    return [];
  }

  const rows = Array.isArray(payload.data) ? payload.data : [];

  return rows
    .map((row) => {
      const symbol = normalizeSymbol(row.symbol as string | undefined);
      if (!symbol) return null;

      const type = mapInstrumentType(row.instrument_type);
      if (!type) return null;

      return {
        symbol,
        displayName: String(row.instrument_name ?? symbol).trim() || symbol,
        quoteCurrency: normalizeSymbol((row.currency as string | undefined) ?? 'USD') || 'USD',
        type,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
}

async function refreshQuotesIntoDatabase() {
  const supabase = createClient(
    getRequiredEnv('SUPABASE_URL'),
    getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')
  );

  const { data: assets, error: assetsError } = await supabase
    .from('market_assets')
    .select('id, symbol, quote_currency')
    .eq('is_active', true)
    .order('sort_order');

  if (assetsError) {
    throw new Error(assetsError.message);
  }

  const symbols = (assets ?? []).map((asset) => normalizeSymbol(asset.symbol)).filter(Boolean);
  const quoteMap = await fetchQuoteBatch(symbols);

  const upserts = (assets ?? [])
    .map((asset) => {
      const symbol = normalizeSymbol(asset.symbol);
      const quote = quoteMap[symbol];
      if (!quote) return null;

      return {
        asset_id: asset.id,
        symbol,
        quote_currency: quote.quoteCurrency,
        price: quote.price,
        open: quote.open,
        high: quote.high,
        low: quote.low,
        volume: quote.volume,
        as_of: quote.asOf,
        provider: 'twelvedata',
        updated_at: new Date().toISOString(),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (upserts.length > 0) {
    const { error: upsertError } = await supabase
      .from('market_quotes')
      .upsert(upserts, { onConflict: 'asset_id' });

    if (upsertError) {
      throw new Error(upsertError.message);
    }
  }

  return {
    totalAssets: assets?.length ?? 0,
    updatedQuotes: upserts.length,
  };
}

async function readQuotesFromDatabase(symbols: string[]) {
  const supabase = createClient(
    getRequiredEnv('SUPABASE_URL'),
    getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')
  );

  if (symbols.length === 0) {
    return { quotesBySymbol: {}, missingSymbols: [] as string[] };
  }

  const { data, error } = await supabase
    .from('market_quotes')
    .select('symbol, quote_currency, price, open, high, low, volume, as_of, provider')
    .in('symbol', symbols);

  if (error) {
    throw new Error(error.message);
  }

  const quotesBySymbol: Record<string, unknown> = {};

  (data ?? []).forEach((row) => {
    const symbol = normalizeSymbol(row.symbol);
    quotesBySymbol[symbol] = {
      symbol,
      quoteCurrency: normalizeSymbol(row.quote_currency) || 'USD',
      price: Number(row.price),
      open: toNumber(row.open),
      high: toNumber(row.high),
      low: toNumber(row.low),
      volume: toNumber(row.volume),
      asOf: String(row.as_of),
      provider: 'twelvedata',
    };
  });

  const missingSymbols = symbols.filter((symbol) => !quotesBySymbol[symbol]);
  return {
    quotesBySymbol,
    missingSymbols,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = String((body as { action?: string })?.action ?? 'quotes').toLowerCase();

    if (action === 'search') {
      const query = String((body as { query?: string })?.query ?? '').trim();
      const results = query ? await fetchSearch(query) : [];
      return jsonResponse({ results });
    }

    if (action === 'refresh') {
      const refreshResult = await refreshQuotesIntoDatabase();
      return jsonResponse({ refreshed: true, ...refreshResult });
    }

    const rawSymbols = Array.isArray((body as { symbols?: unknown[] })?.symbols)
      ? ((body as { symbols?: unknown[] }).symbols ?? [])
      : [];

    const symbols = Array.from(
      new Set(rawSymbols.map((value) => normalizeSymbol(String(value))).filter(Boolean))
    ).slice(0, 120);

    const quotesResult = await readQuotesFromDatabase(symbols);
    return jsonResponse(quotesResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    return jsonResponse({ error: message }, 500);
  }
});
