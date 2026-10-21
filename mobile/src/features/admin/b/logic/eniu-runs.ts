import type { EniuBotRun } from '@/types/social';

export type EniuSourceType = 'post' | 'comment';

export function formatRunDate(value: string): string {
  return new Date(value).toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function runStatusLabel(status: EniuBotRun['status']): string {
  if (status === 'success') return 'Sukces';
  if (status === 'skipped') return 'Pominięto';
  if (status === 'error') return 'Błąd';
  return 'W toku';
}

export function diagnosticText(value: unknown, key: string): string {
  return value && typeof value === 'object' && key in value
    ? String((value as Record<string, unknown>)[key] ?? '')
    : '';
}

export function diagnosticBoolean(value: unknown, key: string): boolean {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)[key] === true
    : false;
}

export function diagnosticMaxTokens(value: unknown): string {
  const raw =
    value && typeof value === 'object' ? (value as Record<string, unknown>).maxTokens : null;
  return typeof raw === 'number' && Number.isFinite(raw) ? `${Math.round(raw / 1000)}k` : '';
}

/** The chips the web shows under a run with provider diagnostics, in order. */
export function diagnosticChips(value: unknown): string[] {
  const chips: string[] = [];
  const model = diagnosticText(value, 'model');
  if (model) chips.push(model);
  if (diagnosticBoolean(value, 'stream')) chips.push('stream');
  const maxTokens = diagnosticMaxTokens(value);
  if (maxTokens) chips.push(maxTokens);
  chips.push(`reasoning: ${diagnosticBoolean(value, 'reasoningPresent') ? 'tak' : 'nie'}`);
  chips.push(`content: ${diagnosticBoolean(value, 'contentPresent') ? 'tak' : 'nie'}`);
  return chips;
}

export function isRetryableSourceType(value: string): value is EniuSourceType {
  return value === 'post' || value === 'comment';
}

export function canRetryRun(run: Pick<EniuBotRun, 'status' | 'sourceType'>): boolean {
  return run.status === 'error' && isRetryableSourceType(run.sourceType);
}
