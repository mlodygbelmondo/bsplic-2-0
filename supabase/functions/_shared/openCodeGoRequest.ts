interface OpenCodeGoMessage {
  role: string;
  content: string;
}

interface RequestBodyInput {
  model: string;
  messages: OpenCodeGoMessage[];
  maxTokens: number;
}

function isKimiModel(model: string) {
  return model.toLowerCase().includes('kimi');
}

export function buildOpenCodeGoRequestBody(input: RequestBodyInput) {
  return {
    model: input.model,
    messages: input.messages,
    stream: true,
    max_tokens: input.maxTokens,
    include_reasoning: false,
    reasoning: {
      enabled: true,
      exclude: true,
    },
    ...(isKimiModel(input.model)
      ? {
          thinking: {
            type: 'enabled',
          },
        }
      : {}),
  };
}
