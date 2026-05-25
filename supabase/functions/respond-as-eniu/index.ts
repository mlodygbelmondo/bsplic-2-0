import {
  corsHeaders,
  generateEniuText,
  getAgentToken,
  getServiceClient,
  getUserClient,
  jsonResponse,
  type SocialBotContext,
} from '../_shared/eniu.ts';

type SourceType = 'post' | 'comment';

interface RespondRequest {
  sourceType: SourceType;
  sourceId: string;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let payload: RespondRequest;

  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (
    (payload.sourceType !== 'post' && payload.sourceType !== 'comment') ||
    typeof payload.sourceId !== 'string' ||
    payload.sourceId.length === 0
  ) {
    return jsonResponse({ error: 'Invalid source' }, 400);
  }

  try {
    const serviceClient = getServiceClient();
    const token = getAgentToken();
    const userClient = getUserClient(request.headers.get('Authorization'));
    const { data: authData, error: authError } =
      await userClient.auth.getUser();

    if (authError || !authData.user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const { data: claim, error: claimError } = await serviceClient.rpc(
      'agent_claim_social_bot_reply',
      {
        p_token: token,
        p_source_type: payload.sourceType,
        p_source_id: payload.sourceId,
        p_actor_user_id: authData.user.id,
      },
    );

    if (claimError) throw claimError;

    if (!claim?.claimed) {
      return jsonResponse({
        ok: true,
        text: null,
        result: claim,
      });
    }

    const { data: context, error: contextError } = await serviceClient.rpc(
      'agent_get_social_context',
      {
        p_token: token,
        p_source_type: payload.sourceType,
        p_source_id: payload.sourceId,
        p_comment_limit: 20,
      },
    );

    if (contextError) throw contextError;

    const responseText = await generateEniuText({
      task: 'reply',
      context: context as SocialBotContext,
    });

    const { data: result, error: addError } = await serviceClient.rpc(
      'agent_add_social_comment',
      {
        p_token: token,
        p_source_type: payload.sourceType,
        p_source_id: payload.sourceId,
        p_content: responseText,
      },
    );

    if (addError) throw addError;

    return jsonResponse({
      ok: true,
      text: responseText,
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    try {
      const serviceClient = getServiceClient();
      const token = getAgentToken();
      await serviceClient.rpc('agent_record_social_bot_error', {
        p_token: token,
        p_source_type: payload.sourceType,
        p_source_id: payload.sourceId,
        p_error: message,
      });
    } catch {
      // Logging must not make the user-facing fallback noisier.
    }

    return jsonResponse({
      ok: false,
      error: 'Eniu did not respond',
    });
  }
});
