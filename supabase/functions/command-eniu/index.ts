import {
  assertAdmin,
  corsHeaders,
  generateEniuText,
  getAgentToken,
  getServiceClient,
  jsonResponse,
} from '../_shared/eniu.ts';

interface CommandRequest {
  command: string;
  preview?: boolean;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let payload: CommandRequest;

  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const command =
    typeof payload.command === 'string' ? payload.command.trim() : '';
  if (!command) {
    return jsonResponse({ error: 'Command is required' }, 400);
  }

  try {
    await assertAdmin(request.headers.get('Authorization'));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    return jsonResponse(
      { error: message },
      message === 'Forbidden' ? 403 : 401,
    );
  }

  try {
    const text = await generateEniuText({
      task: 'admin-post',
      adminCommand: command,
    });

    if (payload.preview) {
      return jsonResponse({
        ok: true,
        preview: true,
        text,
      });
    }

    const serviceClient = getServiceClient();
    const { data: result, error } = await serviceClient.rpc(
      'agent_create_social_post',
      {
        p_token: getAgentToken(),
        p_content: text,
      },
    );

    if (error) throw error;

    return jsonResponse({
      ok: true,
      preview: false,
      text,
      result,
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Eniu command failed',
      },
      500,
    );
  }
});
