export function sanitizeGeneratedText(value: string) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .slice(0, 700);
}

export function looksLikeMetaResponse(value: string) {
  const lower = value.toLowerCase();
  const metaPhrases = [
    "the user wants me",
    "key constraints",
    "must not reveal",
    "system prompt",
    "hidden instructions",
    "persona/prompt",
    "i need to write",
    "i should respond",
    "thinking:",
    "reasoning:",
    "analysis:",
  ];
  const reasoningBlockPatterns = [
    /<\s*thinking\b/i,
    /<\s*\/\s*thinking\s*>/i,
    /<\s*think\b/i,
    /<\s*\/\s*think\s*>/i,
  ];

  return (
    metaPhrases.some((pattern) => lower.includes(pattern)) ||
    reasoningBlockPatterns.some((pattern) => pattern.test(value))
  );
}
