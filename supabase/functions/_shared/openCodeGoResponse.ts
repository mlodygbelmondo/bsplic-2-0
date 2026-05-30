type JsonRecord = Record<string, unknown>;

export interface OpenCodeGoDiagnostic {
  model?: string;
  provider?: string;
  finishReason?: string;
  nativeFinishReason?: string;
  contentPresent: boolean;
  contentChars: number;
  reasoningPresent: boolean;
  reasoningChars: number;
  reasoningTokens?: number;
  reasoningDetailCount?: number;
  responseShape: string;
}

export interface OpenCodeGoResult {
  text: string | null;
  diagnostic: OpenCodeGoDiagnostic;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function firstNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function partType(value: JsonRecord) {
  return typeof value.type === "string" ? value.type.toLowerCase() : "";
}

function isReasoningPart(value: JsonRecord) {
  const type = partType(value);
  return (
    type.includes("reasoning") ||
    type.includes("thinking") ||
    type === "analysis"
  );
}

function isTextPart(value: JsonRecord) {
  const type = partType(value);
  return type === "text" || type === "output_text";
}

function textFromContentPart(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(textFromContentPart);
  if (!isRecord(value) || isReasoningPart(value) || !isTextPart(value)) {
    return [];
  }

  return typeof value.text === "string" ? [value.text] : [];
}

function textFromResponsesOutput(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item) || isReasoningPart(item)) return [];

    if (partType(item) === "output_text") {
      return typeof item.text === "string" ? [item.text] : [];
    }

    if (partType(item) === "message") {
      return textFromContentPart(item.content);
    }

    return [];
  });
}

function getChoice(data: unknown) {
  if (!isRecord(data)) return null;
  const choices = Array.isArray(data.choices) ? data.choices : [];
  return isRecord(choices[0]) ? choices[0] : null;
}

function getChoiceMessage(choice: JsonRecord | null) {
  return isRecord(choice?.message) ? choice.message : null;
}

function getChoiceDelta(choice: JsonRecord | null) {
  return isRecord(choice?.delta) ? choice.delta : null;
}

function supportedTextCandidates(data: JsonRecord) {
  const choice = getChoice(data);
  const message = getChoiceMessage(choice);
  const delta = getChoiceDelta(choice);

  return [
    textFromContentPart(message?.content),
    textFromContentPart(delta?.content),
    typeof choice?.text === "string" ? [choice.text] : [],
    typeof data.output_text === "string" ? [data.output_text] : [],
    textFromResponsesOutput(data.output),
  ];
}

function firstSupportedText(data: unknown, preserveWhitespace = false) {
  if (!isRecord(data)) return null;

  for (const candidate of supportedTextCandidates(data)) {
    const text = candidate.join("");
    const normalized = preserveWhitespace ? text : text.trim();
    if (normalized) return normalized;
  }

  return null;
}

export function extractOpenCodeGoText(data: unknown) {
  return firstSupportedText(data);
}

function extractOpenCodeGoTextPreservingWhitespace(data: unknown) {
  return firstSupportedText(data, true);
}

function reasoningDetailCount(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  return value ? 1 : 0;
}

function collectReasoning(value: unknown, key = "", depth = 0): string[] {
  if (depth > 6) return [];

  const normalizedKey = key.toLowerCase();
  const keyLooksReasoning =
    normalizedKey.includes("reasoning") ||
    normalizedKey.includes("thinking") ||
    normalizedKey === "analysis";

  if (typeof value === "string") {
    return keyLooksReasoning ? [value] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectReasoning(item, key, depth + 1));
  }

  if (!isRecord(value)) return [];

  if (isReasoningPart(value)) {
    const text = typeof value.text === "string" ? value.text : "";
    return [
      text,
      ...Object.entries(value).flatMap(([entryKey, entryValue]) =>
        entryKey === "text"
          ? []
          : collectReasoning(entryValue, entryKey, depth + 1),
      ),
    ].filter(Boolean);
  }

  return Object.entries(value).flatMap(([entryKey, entryValue]) =>
    collectReasoning(entryValue, entryKey, depth + 1),
  );
}

function extractReasoningTokens(data: unknown) {
  if (!isRecord(data)) return undefined;

  const details = isRecord(data.usage)
    ? data.usage.completion_tokens_details ?? data.usage.output_tokens_details
    : null;
  const detailTokens = isRecord(details)
    ? firstNumber(details.reasoning_tokens ?? details.reasoningTokens)
    : null;
  if (detailTokens !== null) return detailTokens;

  const usageTokens = isRecord(data.usage)
    ? firstNumber(data.usage.reasoning_tokens ?? data.usage.reasoningTokens)
    : null;
  return usageTokens ?? undefined;
}

function diagnosticFromData(data: unknown, text: string | null): OpenCodeGoDiagnostic {
  const choice = getChoice(data);
  const message = getChoiceMessage(choice);
  const delta = getChoiceDelta(choice);
  const reasoningParts = collectReasoning(data);
  const reasoningTextLength = reasoningParts.join("").length;

  return {
    model: isRecord(data) ? firstString(data.model) ?? undefined : undefined,
    provider: isRecord(data) ? firstString(data.provider) ?? undefined : undefined,
    finishReason: firstString(choice?.finish_reason) ?? undefined,
    nativeFinishReason: firstString(choice?.native_finish_reason) ?? undefined,
    contentPresent: Boolean(text),
    contentChars: text?.length ?? 0,
    reasoningPresent:
      reasoningTextLength > 0 ||
      Boolean(message?.reasoning_details) ||
      Boolean(delta?.reasoning_content),
    reasoningChars: reasoningTextLength,
    reasoningTokens: extractReasoningTokens(data),
    reasoningDetailCount: reasoningDetailCount(message?.reasoning_details),
    responseShape: describeOpenCodeGoShape(data),
  };
}

function parseSseChunks(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter((line) => line && line !== "[DONE]")
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

function mergeDiagnostics(
  chunks: unknown[],
  text: string | null,
): OpenCodeGoDiagnostic {
  const diagnostics = chunks.map((chunk) => diagnosticFromData(chunk, null));
  const lastWithFinish = diagnostics.findLast((item) => item.finishReason);
  const firstWithModel = diagnostics.find((item) => item.model);
  const firstWithProvider = diagnostics.find((item) => item.provider);
  const reasoningTokens = diagnostics.findLast(
    (item) => item.reasoningTokens !== undefined,
  )?.reasoningTokens;

  return {
    model: firstWithModel?.model,
    provider: firstWithProvider?.provider,
    finishReason: lastWithFinish?.finishReason,
    nativeFinishReason: lastWithFinish?.nativeFinishReason,
    contentPresent: Boolean(text),
    contentChars: text?.length ?? 0,
    reasoningPresent: diagnostics.some((item) => item.reasoningPresent),
    reasoningChars: diagnostics.reduce(
      (total, item) => total + item.reasoningChars,
      0,
    ),
    reasoningTokens,
    reasoningDetailCount: diagnostics.reduce(
      (total, item) => total + (item.reasoningDetailCount ?? 0),
      0,
    ),
    responseShape: chunks.map(describeOpenCodeGoShape).join(" | ").slice(0, 400),
  };
}

export function extractOpenCodeGoResult(data: unknown): OpenCodeGoResult {
  const text = extractOpenCodeGoText(data);
  return {
    text,
    diagnostic: diagnosticFromData(data, text),
  };
}

export function extractOpenCodeGoResultFromText(value: string): OpenCodeGoResult {
  const trimmed = value.trim();
  const sseChunks = parseSseChunks(trimmed);

  if (sseChunks.length > 0) {
    const text = sseChunks
      .map(extractOpenCodeGoTextPreservingWhitespace)
      .filter((item): item is string => typeof item === "string" && item.length > 0)
      .join("")
      .trim();

    return {
      text: text || null,
      diagnostic: mergeDiagnostics(sseChunks, text || null),
    };
  }

  try {
    return extractOpenCodeGoResult(JSON.parse(trimmed));
  } catch {
    return {
      text: null,
      diagnostic: {
        contentPresent: false,
        contentChars: 0,
        reasoningPresent: false,
        reasoningChars: 0,
        responseShape: "root:invalid-json",
      },
    };
  }
}

export function isOpenCodeGoResultComplete(result: OpenCodeGoResult) {
  if (!result.text) return false;

  const finishReason = result.diagnostic.finishReason?.toLowerCase();
  return !finishReason || finishReason === "stop";
}

export function shouldRetryOpenCodeGoResult(result: OpenCodeGoResult) {
  const finishReason = result.diagnostic.finishReason?.toLowerCase();
  const usedHiddenReasoning =
    typeof result.diagnostic.reasoningTokens === "number" &&
    result.diagnostic.reasoningTokens > 0;

  return (
    finishReason === "length" ||
    (!result.text && (result.diagnostic.reasoningPresent || usedHiddenReasoning))
  );
}

function keysOf(value: unknown) {
  return isRecord(value) ? Object.keys(value).slice(0, 12).join(",") : "";
}

export function describeOpenCodeGoShape(data: unknown) {
  if (!isRecord(data)) {
    return `root:${Array.isArray(data) ? "array" : typeof data}`;
  }

  const choices = Array.isArray(data.choices) ? data.choices : [];
  const choice = getChoice(data);
  const message = getChoiceMessage(choice);
  const content = message?.content;
  const contentType = Array.isArray(content)
    ? `array[${content.length}]`
    : content === null
      ? "null"
      : typeof content;
  const contentItem = Array.isArray(content) && isRecord(content[0])
    ? ` content0{${keysOf(content[0])}}`
    : "";

  return [
    `root{${keysOf(data)}}`,
    `choices[${choices.length}]`,
    choice ? `choice{${keysOf(choice)}}` : "choice:none",
    message ? `message{${keysOf(message)}}` : "message:none",
    `content:${contentType}${contentItem}`,
  ].join(" ").slice(0, 400);
}
