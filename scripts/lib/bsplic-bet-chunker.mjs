/**
 * Batching helpers for `agent_create_bets`.
 *
 * The RPC hard-caps at 25 bets per request and silently pushes the rest into
 * `skipped`. A tournament day exceeds that routinely, so payloads are chunked
 * here.
 *
 * Chunking interacts with AKO exclusions: an `ako_ref` only resolves against
 * bets created in the SAME request. Edges that would straddle a chunk boundary
 * are rewritten so they are carried by whichever side lands in the later chunk
 * and point back by `agent_duplicate_key`, which resolves against bets already
 * committed by an earlier chunk.
 */

export const MAX_BETS_PER_REQUEST = 25;

function groupKey(bet, index) {
  const eventKey =
    typeof bet?.event_key === "string" ? bet.event_key.trim() : "";
  return eventKey || `__ungrouped__:${index}`;
}

/**
 * Packs bets into chunks of at most `maxSize`, keeping markets that share an
 * `event_key` together so their `ako_ref` edges stay intra-chunk.
 */
export function chunkBets(bets, maxSize = MAX_BETS_PER_REQUEST) {
  const groups = new Map();

  bets.forEach((bet, index) => {
    const key = groupKey(bet, index);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(bet);
  });

  const chunks = [];
  let current = [];

  const pushCurrent = () => {
    if (current.length > 0) {
      chunks.push(current);
      current = [];
    }
  };

  for (const group of groups.values()) {
    if (group.length > maxSize) {
      // One event with more markets than a single request allows. Split it and
      // let the cross-chunk rewrite below keep its exclusions intact.
      pushCurrent();
      for (let i = 0; i < group.length; i += maxSize) {
        chunks.push(group.slice(i, i + maxSize));
      }
      continue;
    }

    if (current.length + group.length > maxSize) {
      pushCurrent();
    }
    current.push(...group);
  }

  pushCurrent();
  return chunks;
}

function cloneChunks(chunks) {
  return chunks.map((chunk) => chunk.map((bet) => ({ ...bet })));
}

/**
 * Rewrites `ako_ref` edges that cross a chunk boundary.
 *
 * Returns `{ chunks, warnings }`. A warning means a correlated pair could not
 * be preserved across the split — it must be surfaced, because an unenforced
 * exclusion is a bookable arbitrage.
 */
export function rewriteCrossChunkExclusions(chunks) {
  const next = cloneChunks(chunks);
  const warnings = [];

  const byRef = new Map();
  next.forEach((chunk, chunkIndex) => {
    chunk.forEach((bet) => {
      const ref = typeof bet.ako_ref === "string" ? bet.ako_ref.trim() : "";
      if (ref) {
        byRef.set(ref, { bet, chunkIndex });
      }
    });
  });

  next.forEach((chunk, chunkIndex) => {
    chunk.forEach((bet) => {
      if (!Array.isArray(bet.ako_exclusions) || bet.ako_exclusions.length === 0) {
        return;
      }

      const kept = [];

      for (const exclusion of bet.ako_exclusions) {
        const ref =
          typeof exclusion?.ref === "string" ? exclusion.ref.trim() : "";

        if (!ref) {
          // betId / agent_duplicate_key targets resolve server-side against
          // committed rows, so chunking cannot break them.
          kept.push(exclusion);
          continue;
        }

        const target = byRef.get(ref);

        if (!target) {
          warnings.push(
            `ako_ref "${ref}" referenced by "${bet.title ?? "(bez tytułu)"}" does not match any bet in the payload`,
          );
          kept.push(exclusion);
          continue;
        }

        if (target.chunkIndex === chunkIndex) {
          kept.push(exclusion);
          continue;
        }

        const laterIsTarget = target.chunkIndex > chunkIndex;
        const carrier = laterIsTarget ? target.bet : bet;
        const other = laterIsTarget ? bet : target.bet;
        const otherKey =
          typeof other.agent_duplicate_key === "string"
            ? other.agent_duplicate_key.trim()
            : "";

        if (!otherKey) {
          warnings.push(
            `AKO pair "${bet.title ?? "(bez tytułu)"}" <-> "${target.bet.title ?? "(bez tytułu)"}" crosses a batch boundary and the counterpart has no agent_duplicate_key; the exclusion will not be created`,
          );
          kept.push(exclusion);
          continue;
        }

        const rewritten = {
          agent_duplicate_key: otherKey,
          reason: exclusion.reason,
        };

        if (carrier === bet) {
          // The counterpart is in an earlier chunk and is already committed by
          // the time this one is sent, so the edge stays here and points back
          // by key. Do not touch bet.ako_exclusions while iterating it.
          kept.push(rewritten);
          continue;
        }

        // The counterpart lands in a later chunk. Move the edge onto it so it
        // is created once both sides exist; drop it from this bet.
        if (!Array.isArray(carrier.ako_exclusions)) {
          carrier.ako_exclusions = [];
        }

        const alreadyCarried = carrier.ako_exclusions.some(
          (item) => item?.agent_duplicate_key === otherKey,
        );

        if (!alreadyCarried) {
          carrier.ako_exclusions.push(rewritten);
        }
      }

      bet.ako_exclusions = kept;
    });
  });

  return { chunks: next, warnings };
}

export function mergeCreateBetsResults(results) {
  const merged = {
    created: [],
    skipped: [],
    errors: [],
    ako_created: [],
    ako_unresolved: [],
  };

  for (const result of results) {
    for (const field of Object.keys(merged)) {
      const value = result?.[field];
      if (Array.isArray(value)) {
        merged[field].push(...value);
      }
    }
  }

  return merged;
}
