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

const SKIPPED_TEXT_KEYS = new Set([
  "id",
  "model",
  "object",
  "provider",
  "role",
  "type",
  "finish_reason",
  "native_finish_reason",
  "status",
  "created",
  "created_at",
  "error",
  "detail",
]);

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function firstString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function firstNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isHumanText(value: string) {
  const trimmed = value.trim();
  return (
    trimmed.length >= 12 &&
    /\s/.test(trimmed) &&
    !/^[a-z0-9_.:/-]+$/i.test(trimmed)
  );
}

function textFromContent(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => textFromContent(item));
  }

  if (!isRecord(value) || isReasoningPart(value)) {
    return [];
  }

  const type = partType(value);
  const text = value.text;
  if (
    typeof text === "string" &&
    (!type || type === "text" || type === "output_text")
  ) {
    return [text];
  }

  return [
    ...textFromContent(value.message),
    ...textFromContent(value.content),
    ...textFromContent(value.delta),
    ...textFromContent(value.output),
    ...textFromContent(value.output_text),
    ...textFromContent(value.response),
    ...textFromContent(value.completion),
    ...textFromContent(value.answer),
    ...textFromContent(value.reply),
    ...textFromContent(value.value),
    ...textFromContent(value.result),
    ...textFromContent(value.data),
  ];
}

function keysOf(value: unknown) {
  return isRecord(value) ? Object.keys(value).slice(0, 12).join(",") : "";
}

function textFromUnknownFields(value: unknown, key = "", depth = 0): string[] {
  if (depth > 6) return [];

  if (typeof value === "string") {
    const normalizedKey = key.toLowerCase();
    return !SKIPPED_TEXT_KEYS.has(normalizedKey) && isHumanText(value)
      ? [value]
      : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => textFromUnknownFields(item, key, depth + 1));
  }

  if (!isRecord(value) || isReasoningPart(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([entryKey, entryValue]) => {
    const normalizedKey = entryKey.toLowerCase();
    if (
      SKIPPED_TEXT_KEYS.has(normalizedKey) ||
      normalizedKey.includes("reasoning") ||
      normalizedKey.includes("thinking") ||
      normalizedKey.includes("analysis")
    ) {
      return [];
    }

    return textFromUnknownFields(entryValue, entryKey, depth + 1);
  });
}

export function extractOpenCodeGoText(data: unknown) {
  if (!isRecord(data)) return null;

  const choices = Array.isArray(data.choices) ? data.choices : [];
  const firstChoice = choices[0];
  const firstChoiceRecord = isRecord(firstChoice) ? firstChoice : null;
  const message = firstChoiceRecord?.message;
  const messageRecord = isRecord(message) ? message : null;
  const delta = firstChoiceRecord?.delta;
  const deltaRecord = isRecord(delta) ? delta : null;
  const candidates = [
    messageRecord?.content,
    messageRecord?.text,
    messageRecord?.output_text,
    messageRecord?.response,
    deltaRecord?.content,
    deltaRecord?.text,
    deltaRecord?.response,
    firstChoiceRecord?.content,
    firstChoiceRecord?.message,
    firstChoiceRecord?.text,
    firstChoiceRecord?.output_text,
    firstChoiceRecord?.output,
    data.output_text,
    data.response,
    data.completion,
    data.answer,
    data.message,
    data.text,
    data.reply,
    data.content,
    data.output,
    data.result,
    data.data,
  ];

  for (const candidate of candidates) {
    const text = textFromContent(candidate).join("").trim();
    if (text) return text;
  }

  const fallbackText = textFromUnknownFields(data).join("").trim();
  if (fallbackText) return fallbackText;

  return null;
}

function extractOpenCodeGoTextPreservingWhitespace(data: unknown) {
  if (!isRecord(data)) return null;

  const choices = Array.isArray(data.choices) ? data.choices : [];
  const firstChoice = choices[0];
  const firstChoiceRecord = isRecord(firstChoice) ? firstChoice : null;
  const message = firstChoiceRecord?.message;
  const messageRecord = isRecord(message) ? message : null;
  const delta = firstChoiceRecord?.delta;
  const deltaRecord = isRecord(delta) ? delta : null;
  const candidates = [
    messageRecord?.content,
    deltaRecord?.content,
    firstChoiceRecord?.content,
    firstChoiceRecord?.text,
    data.output_text,
    data.response,
    data.completion,
    data.answer,
    data.text,
    data.reply,
    data.content,
    data.output,
  ];

  for (const candidate of candidates) {
    const text = textFromContent(candidate).join("");
    if (text) return text;
  }

  return null;
}

function getChoice(data: unknown) {
  if (!isRecord(data)) return null;
  const choices = Array.isArray(data.choices) ? data.choices : [];
  return isRecord(choices[0]) ? choices[0] : null;
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
  const message = isRecord(choice?.message) ? choice.message : null;
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
      Boolean((isRecord(choice?.delta) ? choice.delta : null)?.reasoning_content),
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

export function describeOpenCodeGoShape(data: unknown) {
  if (!isRecord(data)) {
    return `root:${Array.isArray(data) ? "array" : typeof data}`;
  }

  const choices = Array.isArray(data.choices) ? data.choices : [];
  const firstChoice = choices[0];
  const firstChoiceRecord = isRecord(firstChoice) ? firstChoice : null;
  const message = firstChoiceRecord?.message;
  const messageRecord = isRecord(message) ? message : null;
  const content = messageRecord?.content;
  const contentType = Array.isArray(content)
    ? `array[${content.length}]`
    : content === null
      ? "null"
      : typeof content;
  const contentItem = Array.isArray(content) && isRecord(content[0])
    ? ` content0{${keysOf(content[0])}} type:${firstString(content[0].type) ?? ""}`
    : "";

  return [
    `root{${keysOf(data)}}`,
    `choices[${choices.length}]`,
    firstChoiceRecord ? `choice{${keysOf(firstChoiceRecord)}}` : "choice:none",
    messageRecord ? `message{${keysOf(messageRecord)}}` : "message:none",
    `content:${contentType}${contentItem}`,
  ].join(" ").slice(0, 400);
}
