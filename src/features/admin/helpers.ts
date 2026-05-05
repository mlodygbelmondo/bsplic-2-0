import { BetOption } from '@/types/database';
import type { EditableBetType } from './constants';

export interface EditableBetOption {
  name: string;
  odds: string;
}

export const getErrorMessage = (error: unknown, fallback: string): string => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
};

export const toInputDateTime = (value: Date | string): string => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
};

export const getTomorrowAt2359 = (): Date => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(23, 59, 0, 0);
  return date;
};

export const normalizeType = (value: string): EditableBetType => {
  if (value === 'single' || value === '1x2' || value === 'multi') return value;
  return '12';
};

export const normalizeOptions = (options: unknown): BetOption[] => {
  if (!Array.isArray(options)) return [];
  return options.map((option, index) => ({
    name: typeof (option as BetOption)?.name === 'string' ? (option as BetOption).name : `Opcja ${index + 1}`,
    odds: Number((option as BetOption)?.odds) > 0 ? Number((option as BetOption).odds) : 1,
  }));
};

export const lockOptionsByType = (type: EditableBetType, current: BetOption[]): BetOption[] => {
  if (type === 'single') {
    return [{ name: current[0]?.name || '1', odds: current[0]?.odds || 2 }];
  }
  if (type === '12') {
    return [
      { name: current[0]?.name || '1', odds: current[0]?.odds || 2 },
      { name: current[1]?.name || '2', odds: current[1]?.odds || 2 },
    ];
  }
  if (type === '1x2') {
    return [
      { name: current[0]?.name || '1', odds: current[0]?.odds || 2 },
      { name: current[1]?.name || 'X', odds: current[1]?.odds || 3 },
      { name: current[2]?.name || '2', odds: current[2]?.odds || 2 },
    ];
  }
  if (current.length >= 2) return current;
  return [
    { name: '', odds: 2 },
    { name: '', odds: 2 },
  ];
};

export const toEditableOptions = (options: BetOption[]): EditableBetOption[] =>
  options.map((option) => ({
    name: option.name,
    odds: String(option.odds),
  }));

export const lockEditableOptionsByType = (type: EditableBetType, current: EditableBetOption[]): EditableBetOption[] => {
  if (type === 'single') {
    return [{ name: current[0]?.name || '1', odds: current[0]?.odds ?? '2' }];
  }
  if (type === '12') {
    return [
      { name: current[0]?.name || '1', odds: current[0]?.odds ?? '2' },
      { name: current[1]?.name || '2', odds: current[1]?.odds ?? '2' },
    ];
  }
  if (type === '1x2') {
    return [
      { name: current[0]?.name || '1', odds: current[0]?.odds ?? '2' },
      { name: current[1]?.name || 'X', odds: current[1]?.odds ?? '3' },
      { name: current[2]?.name || '2', odds: current[2]?.odds ?? '2' },
    ];
  }
  if (current.length >= 2) return current;
  return [
    { name: '', odds: '2' },
    { name: '', odds: '2' },
  ];
};

export const normalizeCouponStatus = (
  value: string | null | undefined
): 'pending' | 'won' | 'lost' | 'refund' => {
  if (value === 'won' || value === 'lost' || value === 'refund') return value;
  return 'pending';
};

/**
 * Parse a winning_option value which may be a JSON array (multi-winner)
 * or a plain string (single winner / sentinel values).
 */
export const parseWinningOptions = (value: string | null): string[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string');
  } catch {
    // not JSON — single value
  }
  return [value];
};

/**
 * Encode an array of winning option names into the winning_option field.
 * Single winner  -> plain string for backward compatibility.
 * Multi winner   -> JSON array string.
 */
export const encodeWinningOptions = (names: string[]): string => {
  if (names.length === 1) return names[0];
  return JSON.stringify(names);
};
