import { describe, expect, it } from 'vitest';

import {
  MAX_BETS_PER_REQUEST,
  chunkBets,
  mergeCreateBetsResults,
  rewriteCrossChunkExclusions,
} from '../../scripts/lib/bsplic-bet-chunker.mjs';

// `agent_create_bets` caps at 25 bets per request and an `ako_ref` only resolves
// within one request, so batching must not silently drop a correlated pair.

interface TestBet {
  title: string;
  event_key?: string;
  agent_duplicate_key?: string;
  ako_ref?: string;
  ako_exclusions?: Array<Record<string, unknown>>;
}

function bet(title: string, extra: Partial<TestBet> = {}): TestBet {
  return { title, ...extra };
}

describe('agent bet chunker', () => {
  it('keeps payloads at or below the request cap in one batch', () => {
    const bets = Array.from({ length: MAX_BETS_PER_REQUEST }, (_, i) =>
      bet(`market ${i}`),
    );

    expect(chunkBets(bets)).toHaveLength(1);
  });

  it('splits payloads above the cap', () => {
    const bets = Array.from({ length: 60 }, (_, i) => bet(`market ${i}`));
    const chunks = chunkBets(bets);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(MAX_BETS_PER_REQUEST);
    }
    expect(chunks.flat()).toHaveLength(60);
  });

  it('keeps markets sharing an event_key in the same batch', () => {
    const bets = [
      ...Array.from({ length: 24 }, (_, i) => bet(`filler ${i}`)),
      bet('winner', { event_key: 'evt-1' }),
      bet('over/under', { event_key: 'evt-1' }),
      bet('btts', { event_key: 'evt-1' }),
    ];

    const chunks = chunkBets(bets);
    const eventChunks = chunks.filter((chunk) =>
      chunk.some((item) => item.event_key === 'evt-1'),
    );

    expect(eventChunks).toHaveLength(1);
    expect(
      eventChunks[0].filter((item) => item.event_key === 'evt-1'),
    ).toHaveLength(3);
  });

  it('leaves intra-batch ref exclusions untouched', () => {
    const chunks = [
      [
        bet('A', { ako_ref: 'a', ako_exclusions: [{ ref: 'b' }] }),
        bet('B', { ako_ref: 'b' }),
      ],
    ];

    const { chunks: rewritten, warnings } = rewriteCrossChunkExclusions(chunks);

    expect(warnings).toEqual([]);
    expect(rewritten[0][0].ako_exclusions).toEqual([{ ref: 'b' }]);
  });

  // The edge that matters: A is published in batch 1, B in batch 2. A `ref`
  // pointing forward would never resolve, so the edge is moved onto B and
  // points back by agent_duplicate_key, which resolves against committed rows.
  it('moves a forward-pointing cross-batch exclusion onto the later bet', () => {
    const chunks = [
      [
        bet('A', {
          ako_ref: 'a',
          agent_duplicate_key: 'key-a',
          ako_exclusions: [{ ref: 'b', reason: 'ten sam mecz' }],
        }),
      ],
      [bet('B', { ako_ref: 'b', agent_duplicate_key: 'key-b' })],
    ];

    const { chunks: rewritten, warnings } = rewriteCrossChunkExclusions(chunks);

    expect(warnings).toEqual([]);
    expect(rewritten[0][0].ako_exclusions).toEqual([]);
    expect(rewritten[1][0].ako_exclusions).toEqual([
      { agent_duplicate_key: 'key-a', reason: 'ten sam mecz' },
    ]);
  });

  it('rewrites a backward-pointing cross-batch exclusion in place', () => {
    const chunks = [
      [bet('A', { ako_ref: 'a', agent_duplicate_key: 'key-a' })],
      [
        bet('B', {
          ako_ref: 'b',
          agent_duplicate_key: 'key-b',
          ako_exclusions: [{ ref: 'a', reason: 'ten sam mecz' }],
        }),
      ],
    ];

    const { chunks: rewritten, warnings } = rewriteCrossChunkExclusions(chunks);

    expect(warnings).toEqual([]);
    expect(rewritten[1][0].ako_exclusions).toEqual([
      { agent_duplicate_key: 'key-a', reason: 'ten sam mecz' },
    ]);
  });

  it('warns when a cross-batch pair cannot be preserved', () => {
    const chunks = [
      [bet('A', { ako_ref: 'a', ako_exclusions: [{ ref: 'b' }] })],
      [bet('B', { ako_ref: 'b' })],
    ];

    const { warnings } = rewriteCrossChunkExclusions(chunks);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('agent_duplicate_key');
  });

  it('warns when a ref points at nothing', () => {
    const chunks = [[bet('A', { ako_ref: 'a', ako_exclusions: [{ ref: 'ghost' }] })]];

    const { warnings } = rewriteCrossChunkExclusions(chunks);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('ghost');
  });

  it('passes betId and agent_duplicate_key targets through untouched', () => {
    const chunks = [
      [
        bet('A', {
          ako_exclusions: [
            { betId: 'some-uuid' },
            { agent_duplicate_key: 'yesterday-key' },
          ],
        }),
      ],
    ];

    const { chunks: rewritten, warnings } = rewriteCrossChunkExclusions(chunks);

    expect(warnings).toEqual([]);
    expect(rewritten[0][0].ako_exclusions).toHaveLength(2);
  });

  it('merges results across batches', () => {
    const merged = mergeCreateBetsResults([
      { created: [{ id: '1' }], skipped: [], errors: [], ako_created: [], ako_unresolved: [] },
      {
        created: [{ id: '2' }],
        skipped: [{ reason: 'dup' }],
        errors: [],
        ako_created: [{ bet_id_a: '1', bet_id_b: '2' }],
        ako_unresolved: [],
      },
    ]);

    expect(merged.created).toHaveLength(2);
    expect(merged.skipped).toHaveLength(1);
    expect(merged.ako_created).toHaveLength(1);
  });
});
