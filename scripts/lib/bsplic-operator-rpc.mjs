export function readOperatorEnv(env = process.env) {
  const url = env.BSPLIC_OPERATOR_SUPABASE_URL?.trim().replace(/\/+$/, "");
  const serviceRoleKey = env.BSPLIC_OPERATOR_SERVICE_ROLE_KEY?.trim();

  if (!url) {
    throw new Error(
      "Missing BSPLIC_OPERATOR_SUPABASE_URL for global season reset.",
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "Missing BSPLIC_OPERATOR_SERVICE_ROLE_KEY for global season reset.",
    );
  }

  return { url, serviceRoleKey };
}

export async function callOperatorRpc(rpcName, params = {}, env = process.env) {
  const { url, serviceRoleKey } = readOperatorEnv(env);
  const response = await fetch(`${url}/rest/v1/rpc/${rpcName}`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    throw new Error(
      `RPC ${rpcName} failed with HTTP ${response.status}: ${JSON.stringify(payload)}`,
    );
  }

  return payload;
}

export function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
