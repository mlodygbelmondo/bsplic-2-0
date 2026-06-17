export interface AkoSelection {
  betId: string;
  title: string;
}

export interface AkoExclusion {
  betIdA: string;
  betIdB: string;
  reason: string | null;
}

export interface AkoConflict {
  betIdA: string;
  betIdB: string;
  titleA: string;
  titleB: string;
  reason: string | null;
}

function pairKey(firstId: string, secondId: string): string {
  return [firstId, secondId].sort().join(':');
}

export function findAkoConflict(
  selections: AkoSelection[],
  exclusions: AkoExclusion[],
): AkoConflict | null {
  const selectedById = new Map(
    selections.map((selection) => [selection.betId, selection]),
  );

  if (selectedById.size < 2) {
    return null;
  }

  const selectedOrder = new Map(
    selections.map((selection, index) => [selection.betId, index]),
  );
  const seenPairs = new Set<string>();

  for (const exclusion of exclusions) {
    if (exclusion.betIdA === exclusion.betIdB) {
      continue;
    }

    const first = selectedById.get(exclusion.betIdA);
    const second = selectedById.get(exclusion.betIdB);

    if (!first || !second) {
      continue;
    }

    const key = pairKey(first.betId, second.betId);
    if (seenPairs.has(key)) {
      continue;
    }
    seenPairs.add(key);

    const firstIndex = selectedOrder.get(first.betId) ?? 0;
    const secondIndex = selectedOrder.get(second.betId) ?? 0;
    const [left, right] =
      firstIndex <= secondIndex ? [first, second] : [second, first];

    return {
      betIdA: left.betId,
      betIdB: right.betId,
      titleA: left.title,
      titleB: right.title,
      reason: exclusion.reason,
    };
  }

  return null;
}

export function shouldBlockAkoCoupon(
  activeTab: 'single' | 'ako',
  selections: AkoSelection[],
  exclusions: AkoExclusion[],
): boolean {
  return activeTab === 'ako' && findAkoConflict(selections, exclusions) !== null;
}

export function formatAkoConflictMessage(conflict: AkoConflict): string {
  const base = `Tych zdarzeń nie można łączyć na AKO: ${conflict.titleA} + ${conflict.titleB}`;
  return conflict.reason ? `${base}. Powód: ${conflict.reason}` : base;
}
