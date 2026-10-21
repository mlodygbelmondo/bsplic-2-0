import { describe, expect, it } from 'vitest';

import {
  buildAcceptProposalParams,
  createProposalEditor,
  normalizeProposalRow,
  type ProposalEditor,
} from './proposal-review';

// Fixtures from the web `ProposalsTab.test.tsx`.
const humanRaw = {
  id: 'proposal-human',
  user_id: 'user-human',
  title: 'Człowiek: nowy kupon',
  category_id: null,
  bet_type: '1x2',
  options: [
    { name: '1', odds: 1.9 },
    { name: 'X', odds: 3.2 },
    { name: '2', odds: 2.1 },
  ],
  ends_at: '2030-01-01T10:00:00.000Z',
};

const agentRaw = {
  id: 'proposal-agent',
  user_id: 'user-agent',
  title: 'Agent: sygnał wartościowy',
  category_id: null,
  bet_type: '12',
  options: [
    { name: '1', odds: 2.05 },
    { name: '2', odds: 1.75 },
  ],
  ends_at: '2030-01-02T10:00:00.000Z',
  proposal_source: 'agent',
  agent_metadata: {
    confidence: 'high',
    reason: 'Kurs odchyla się od historycznej średniej',
    sources: ['https://example.com/source-1', 'https://example.com/source-2'],
    checkedRecentBetIds: ['bet-1', 'bet-2', 'bet-3'],
  },
  agent_duplicate_key: 'dup-123',
};

const editorFor = (overrides: Partial<ProposalEditor>): ProposalEditor => ({
  ...createProposalEditor(normalizeProposalRow(humanRaw, 'Tomek')),
  ...overrides,
});

describe('normalizeProposalRow', () => {
  it('treats rows without a source as human and keeps agent metadata for agent rows', () => {
    const human = normalizeProposalRow(humanRaw, undefined);
    expect(human.proposal_source).toBe('human');
    expect(human.agent_metadata).toBeNull();
    expect(human.username).toBe('Użytkownik');

    const agent = normalizeProposalRow(agentRaw, 'RobotX');
    expect(agent.proposal_source).toBe('agent');
    expect(agent.username).toBe('RobotX');
    expect(agent.agent_metadata?.confidence).toBe('high');
    expect(agent.agent_metadata?.sources).toHaveLength(2);
    expect(agent.agent_duplicate_key).toBe('dup-123');
  });
});

describe('createProposalEditor', () => {
  it('defaults a missing end date to tomorrow 23:59 local time', () => {
    const editor = createProposalEditor(
      normalizeProposalRow({ ...humanRaw, ends_at: null }, 'Tomek'),
      new Date(2030, 0, 10, 8, 15),
    );
    expect(editor.endsAt).toBe('2030-01-11T23:59');
    expect(editor.isBsplicboost).toBe(false);
    expect(editor.categoryId).toBe('');
  });
});

describe('buildAcceptProposalParams', () => {
  it('builds the review RPC payload for an unchanged proposal', () => {
    expect(buildAcceptProposalParams(editorFor({}))).toEqual({
      ok: true,
      params: {
        p_proposal_id: 'proposal-human',
        p_status: 'accepted',
        p_title: 'Człowiek: nowy kupon',
        p_category_id: null,
        p_bet_type: '1x2',
        p_options: [
          { name: '1', odds: 1.9 },
          { name: 'X', odds: 3.2 },
          { name: '2', odds: 2.1 },
        ],
        p_ends_at: '2030-01-01T10:00:00.000Z',
        p_is_bsplicboost: false,
      },
    });
  });

  it('rejects a fixed-type proposal with a blank option', () => {
    const editor = editorFor({});
    editor.options = [editor.options[0], { name: '  ', odds: '3' }, editor.options[2]];
    expect(buildAcceptProposalParams(editor)).toEqual({
      ok: false,
      error: 'Nieprawidłowa liczba opcji',
    });
  });

  it('requires at least two named options for multi bets', () => {
    expect(
      buildAcceptProposalParams(
        editorFor({ betType: 'multi', options: [{ name: 'A', odds: '2' }, { name: '', odds: '2' }] }),
      ),
    ).toEqual({ ok: false, error: 'Nieprawidłowa liczba opcji' });

    const result = buildAcceptProposalParams(
      editorFor({
        betType: 'multi',
        options: [
          { name: ' A ', odds: '2' },
          { name: 'B', odds: '1.5' },
          { name: 'C', odds: '7' },
        ],
        categoryId: 'cat-1',
        isBsplicboost: true,
      }),
    );
    expect(result.ok && result.params.p_options).toEqual([
      { name: 'A', odds: 2 },
      { name: 'B', odds: 1.5 },
      { name: 'C', odds: 7 },
    ]);
    expect(result.ok && result.params.p_category_id).toBe('cat-1');
    expect(result.ok && result.params.p_is_bsplicboost).toBe(true);
  });

  it('names the first option with invalid odds', () => {
    const editor = editorFor({});
    editor.options = [
      { name: '1', odds: '1.9' },
      { name: 'X', odds: 'abc' },
      { name: '2', odds: '0' },
    ];
    expect(buildAcceptProposalParams(editor)).toEqual({
      ok: false,
      error: 'Podaj poprawny kurs dla opcji 2',
    });
  });

  it('requires a title and a valid end date', () => {
    expect(buildAcceptProposalParams(editorFor({ title: '   ' }))).toEqual({
      ok: false,
      error: 'Tytuł jest wymagany',
    });
    expect(buildAcceptProposalParams(editorFor({ endsAt: 'jutro' }))).toEqual({
      ok: false,
      error: 'Wybierz poprawną datę zakończenia',
    });
  });
});
