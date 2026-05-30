interface OpenCodeGoMessage {
  role: string;
  content: string;
}

interface RequestBodyInput {
  model: string;
  messages: OpenCodeGoMessage[];
  maxTokens: number;
}

export function buildOpenCodeGoRequestBody(input: RequestBodyInput) {
  return {
    model: input.model,
    messages: input.messages,
    stream: true,
    max_tokens: input.maxTokens,
  };
}
