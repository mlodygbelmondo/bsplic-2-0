import type { Json } from '@/lib/database.types';

export interface AgentRun {
  id: string;
  kind: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  created_count: number;
  settled_count: number;
  held_count: number;
  summary: Json;
  report: string | null;
}

export function numberFromSummary(summary: Json, keys: string[]): number {
  if (!summary || Array.isArray(summary) || typeof summary !== 'object') return 0;

  for (const key of keys) {
    const value = summary[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (Array.isArray(value)) return value.length;
  }
  return 0;
}

export const runSkipped = (run: AgentRun): number =>
  numberFromSummary(run.summary, ['skipped', 'skipped_count']);

export const runErrors = (run: AgentRun): number =>
  numberFromSummary(run.summary, ['errors', 'error_count']);

export function formatAgentRunDate(value: string | null): string {
  if (!value) return 'w toku';
  return new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(new Date(value));
}

export type AgentRunTone = 'running' | 'ok' | 'partial' | 'failed' | 'unknown';

export interface AgentRunPresentation {
  label: string;
  tone: AgentRunTone;
}

const STATUS_PRESENTATION: Record<string, AgentRunPresentation> = {
  running: { label: 'W toku', tone: 'running' },
  ok: { label: 'OK', tone: 'ok' },
  partial: { label: 'Częściowy', tone: 'partial' },
  failed: { label: 'Błąd', tone: 'failed' },
};

export function presentationFor(status: string): AgentRunPresentation {
  return STATUS_PRESENTATION[status] ?? { label: status, tone: 'unknown' };
}

/** History row subtitle (web copy, numbers are not pluralized). */
export const runHistorySummary = (run: AgentRun): string =>
  `+${run.created_count} dodanych, ${run.settled_count} rozliczonych, ${run.held_count} wstrzymanych, ${runErrors(run)} błędów`;
