import {
  createMcpHandler,
  McpServer,
} from 'npm:@modelcontextprotocol/server@2.0.0';
import * as z from 'npm:zod@4.5.4';
import {
  validateBets,
  validateSettlements,
  type AgentBetInput,
  type AgentSettlementInput,
} from './validation.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
const agentToken = Deno.env.get('BSPLIC_AGENT_TOKEN');
const mcpAccessToken = Deno.env.get('BSPLIC_MCP_ACCESS_TOKEN');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, content-type, mcp-protocol-version, mcp-session-id, x-mcp-access-token',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Expose-Headers': 'mcp-session-id, www-authenticate',
};

const optionSchema = z.object({
  name: z.string().min(1).describe('Exact public option label shown in BSPLIC'),
  odds: z.number().gt(1).describe('Live decimal bookmaker price'),
});

const exclusionSchema = z.object({
  ref: z.string().optional().describe('ako_ref of a market in the same call'),
  betId: z.string().uuid().optional().describe('Existing BSPLIC market UUID'),
  agent_duplicate_key: z.string().optional(),
  reason: z.string().min(1).describe('Why the markets are correlated'),
});

const betSchema = z.object({
  title: z.string().min(1),
  category_id: z.string().uuid().nullable().optional(),
  bet_type: z.enum(['single', '12', '1x2', 'multi']),
  options: z.array(optionSchema).min(1),
  ends_at: z
    .string()
    .describe(
      'ISO timestamp equal to agent_metadata.event_starts_at; never move it to preserve a betting window',
    ),
  is_live: z.boolean().optional(),
  is_bsplicboost: z.boolean().optional(),
  event_key: z
    .string()
    .min(1)
    .describe('Stable key shared by markets for one event'),
  agent_duplicate_key: z
    .string()
    .min(1)
    .describe('Stable unique key for this event and market'),
  ako_ref: z.string().min(1).describe('Unique reference within this call'),
  ako_exclusions: z.array(exclusionSchema).optional(),
  agent_metadata: z
    .object({
      event_starts_at: z
        .string()
        .describe('Verified real event start as an ISO timestamp'),
      schedule_source: z.object({
        provider: z.string().min(1),
        url: z
          .string()
          .url()
          .describe('HTTPS event or schedule page showing the start time'),
        observed_at: z
          .string()
          .describe('ISO timestamp from the last 24 hours'),
        displayed_start: z
          .string()
          .min(1)
          .describe('Start date and time exactly as displayed by the source'),
        timezone: z
          .string()
          .min(1)
          .describe('Timezone used to interpret displayed_start'),
      }),
      odds_source: z.object({
        bookmaker: z.string().min(1),
        url: z
          .string()
          .url()
          .describe('HTTPS page where the prices were observed'),
        observed_at: z
          .string()
          .describe('ISO timestamp from the last six hours'),
        prices: z
          .record(z.string(), z.number())
          .describe('Option label to exact bookmaker price mapping'),
      }),
    })
    .loose(),
});

const settlementSchema = z.object({
  bet_id: z.string().uuid(),
  hold: z.boolean().optional(),
  reason: z.string().optional().describe('Required when hold is true'),
  mode: z.enum(['normal', 'refund', 'force_lost']).optional(),
  scope: z.enum(['pending_only', 'all']).optional(),
  winning_options: z.array(z.string()).optional(),
  evidence: z
    .object({
      sources: z.array(z.string().url()).optional(),
      confidence: z.string().optional(),
      note: z.string().optional(),
    })
    .loose()
    .optional(),
});

function requireEnvironment(): void {
  if (!supabaseUrl || !supabaseAnonKey || !agentToken || !mcpAccessToken) {
    throw new Error('BSPLIC MCP server environment is incomplete');
  }
}

async function callAgentRpc(
  rpcName: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  requireEnvironment();

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${rpcName}`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey!,
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...params, p_token: agentToken }),
  });
  const text = await response.text();
  let payload: unknown = text;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    // Preserve a non-JSON PostgREST error body for diagnostics.
  }

  if (!response.ok) {
    throw new Error(
      `RPC ${rpcName} failed with HTTP ${response.status}: ${JSON.stringify(payload)}`,
    );
  }
  return payload;
}

function toolResult(payload: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
    structuredContent:
      payload && typeof payload === 'object'
        ? (payload as Record<string, unknown>)
        : { result: payload },
  };
}

function toolError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true,
    content: [{ type: 'text' as const, text: message }],
  };
}

function createServer(): McpServer {
  const server = new McpServer(
    { name: 'bsplic-bet-agent', version: '1.0.0' },
    {
      instructions:
        'Operate the BSPLIC sportsbook autonomously. Start each daily run, settle every ended publicly verifiable market first, and hold anything unverifiable instead of guessing. Then inspect inventory and create useful upcoming markets from fresh real bookmaker prices. Preserve exact option labels, prevent duplicates, set AKO exclusions for correlated markets, and always finish the run with honest counts and status.',
    },
  );

  server.registerTool(
    'start_daily_run',
    {
      title: 'Start BSPLIC daily run',
      description:
        'Create the audit record for one daily autonomous sportsbook run. Call exactly once before reading or changing bets.',
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    async () => {
      try {
        return toolResult(
          await callAgentRpc('agent_start_run', { p_kind: 'daily' }),
        );
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'get_pending_settlements',
    {
      title: 'List BSPLIC markets to settle',
      description:
        'Return ended or unresolved markets, their exact options, existing holds, and coupon counts. Research each public result before settling. Private or unverifiable bets must be held.',
      inputSchema: z.object({
        limit: z.number().int().min(1).max(200).default(100),
        offset: z.number().int().min(0).default(0),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ limit, offset }) => {
      try {
        return toolResult(
          await callAgentRpc('agent_get_pending_settlement_context', {
            p_limit: limit,
            p_offset: offset,
          }),
        );
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'settle_or_hold_bets',
    {
      title: 'Settle or hold BSPLIC markets',
      description:
        'Settle verified markets or record explicit holds. A settlement needs high confidence, an exact option mapping, a note with the final result, and at least one public HTTPS source. Never infer a private or ambiguous result.',
      inputSchema: z.object({
        run_id: z.string().uuid(),
        settlements: z.array(settlementSchema).min(1).max(50),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
      },
    },
    async ({ run_id, settlements }) => {
      try {
        const validationErrors = validateSettlements(
          settlements as AgentSettlementInput[],
        );
        if (validationErrors.length) {
          throw new Error(
            `Settlement rejected: ${validationErrors.join('; ')}`,
          );
        }

        const settled: unknown[] = [];
        const held: unknown[] = [];
        const errors: Array<{ bet_id: string; reason: string }> = [];

        for (const entry of settlements) {
          try {
            if (entry.hold === true) {
              held.push(
                await callAgentRpc('agent_flag_settlement_hold', {
                  p_bet_id: entry.bet_id,
                  p_reason: entry.reason,
                  p_run_id: run_id,
                }),
              );
              continue;
            }

            settled.push(
              await callAgentRpc('agent_settle_bet', {
                p_bet_id: entry.bet_id,
                p_winning_options: entry.winning_options ?? [],
                p_mode: entry.mode ?? 'normal',
                p_scope: entry.scope ?? 'pending_only',
                p_evidence: { ...entry.evidence, run_id },
              }),
            );
          } catch (error) {
            errors.push({
              bet_id: entry.bet_id,
              reason: error instanceof Error ? error.message : String(error),
            });
          }
        }

        return toolResult({
          settled_count: settled.length,
          held_count: held.length,
          error_count: errors.length,
          settled,
          held,
          errors,
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'get_bet_inventory',
    {
      title: 'Inspect BSPLIC bet inventory',
      description:
        'Return categories, active markets, recent and historical markets, duplicate keys, pending proposals, odds provenance, and current AKO exclusions. Use this before creating markets.',
      inputSchema: z.object({
        recent_limit: z.number().int().min(1).max(50).default(25),
        history_limit: z.number().int().min(1).max(500).default(200),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ recent_limit, history_limit }) => {
      try {
        return toolResult(
          await callAgentRpc('agent_get_bet_context', {
            p_recent_bet_limit: recent_limit,
            p_history_limit: history_limit,
          }),
        );
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'create_bets',
    {
      title: 'Create sourced BSPLIC markets',
      description:
        'Create up to 25 deduplicated markets. ends_at must equal the verified real event start from schedule_source. Never postpone ends_at to preserve a betting window: skip events starting in under two hours. Prices must exactly match a named bookmaker source observed in the last six hours. Include AKO exclusions for markets from the same event or otherwise correlated.',
      inputSchema: z.object({ bets: z.array(betSchema).min(1).max(25) }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
      },
    },
    async ({ bets }) => {
      try {
        const validationErrors = validateBets(bets as AgentBetInput[]);
        if (validationErrors.length) {
          throw new Error(
            `Bet creation rejected: ${validationErrors.join('; ')}`,
          );
        }
        return toolResult(
          await callAgentRpc('agent_create_bets', { p_bets: bets }),
        );
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'set_ako_exclusions',
    {
      title: 'Correct BSPLIC AKO exclusions',
      description:
        'Replace all AKO exclusions for one existing market. Use when create_bets reports an unresolved exclusion or inventory reveals a missing correlated pair.',
      inputSchema: z.object({
        bet_id: z.string().uuid(),
        exclusions: z.array(
          z.object({
            betId: z.string().uuid(),
            reason: z.string().min(1),
          }),
        ),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
      },
    },
    async ({ bet_id, exclusions }) => {
      try {
        return toolResult(
          await callAgentRpc('agent_set_bet_ako_exclusions', {
            p_bet_id: bet_id,
            p_exclusions: exclusions,
          }),
        );
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'finish_daily_run',
    {
      title: 'Finish BSPLIC daily run',
      description:
        'Close the audit record after all settlement and creation work. Use partial if any tool item failed or an AKO exclusion remains unresolved. Counts must match tool results.',
      inputSchema: z.object({
        run_id: z.string().uuid(),
        status: z.enum(['ok', 'partial', 'failed']),
        counts: z.object({
          created: z.number().int().min(0),
          settled: z.number().int().min(0),
          held: z.number().int().min(0),
        }),
        summary: z.record(z.string(), z.unknown()).default({}),
        report: z.string().max(10000).optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ run_id, status, counts, summary, report }) => {
      try {
        return toolResult(
          await callAgentRpc('agent_finish_run', {
            p_run_id: run_id,
            p_status: status,
            p_counts: counts,
            p_summary: summary,
            p_report: report ?? null,
          }),
        );
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'get_recent_runs',
    {
      title: 'Read recent BSPLIC agent runs',
      description:
        'Read recent audit records to detect a missed, failed, partial, or still-running daily job.',
      inputSchema: z.object({
        limit: z.number().int().min(1).max(50).default(10),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ limit }) => {
      try {
        return toolResult(
          await callAgentRpc('agent_get_recent_runs', { p_limit: limit }),
        );
      } catch (error) {
        return toolError(error);
      }
    },
  );

  return server;
}

const handler = createMcpHandler(createServer);

function hasValidAccessToken(request: Request): boolean {
  if (!mcpAccessToken) return false;
  const auth = request.headers.get('authorization');
  const headerToken = auth?.match(/^Bearer\s+(.+)$/i)?.[1];
  const directHeaderToken = request.headers.get('x-mcp-access-token');
  const queryToken = new URL(request.url).searchParams.get('access_token');
  return [headerToken, directHeaderToken, queryToken].some(
    (candidate) => candidate === mcpAccessToken,
  );
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(corsHeaders)) {
    headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (!hasValidAccessToken(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'WWW-Authenticate': 'Bearer realm="bsplic-agent-mcp"',
      },
    });
  }

  try {
    return withCors(await handler.fetch(request));
  } catch (error) {
    console.error('MCP request failed', error);
    return new Response(JSON.stringify({ error: 'MCP request failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
