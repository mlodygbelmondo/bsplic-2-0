import { describe, it, expect } from 'vitest';
import { buildCommentTree, countComments, type FlatComment } from './thread';

function makeComment(overrides: Partial<FlatComment> & { id: string }): FlatComment {
  return {
    user_id: 'user-1',
    username: 'testuser',
    content: 'test comment',
    parent_id: null,
    created_at: '2026-03-16T12:00:00Z',
    reactions: null,
    my_reaction: null,
    ...overrides,
  };
}

describe('buildCommentTree', () => {
  it('returns empty array for empty input', () => {
    expect(buildCommentTree([])).toEqual([]);
  });

  it('returns all comments as roots when no parent_id', () => {
    const comments: FlatComment[] = [
      makeComment({ id: 'c1', content: 'first' }),
      makeComment({ id: 'c2', content: 'second' }),
    ];

    const tree = buildCommentTree(comments);
    expect(tree).toHaveLength(2);
    expect(tree[0].children).toEqual([]);
    expect(tree[1].children).toEqual([]);
  });

  it('nests child comments under parent', () => {
    const comments: FlatComment[] = [
      makeComment({ id: 'c1', content: 'parent' }),
      makeComment({ id: 'c2', content: 'child', parent_id: 'c1' }),
    ];

    const tree = buildCommentTree(comments);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('c1');
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].id).toBe('c2');
  });

  it('supports deeply nested threads', () => {
    const comments: FlatComment[] = [
      makeComment({ id: 'c1', content: 'root' }),
      makeComment({ id: 'c2', content: 'level 1', parent_id: 'c1' }),
      makeComment({ id: 'c3', content: 'level 2', parent_id: 'c2' }),
      makeComment({ id: 'c4', content: 'level 3', parent_id: 'c3' }),
    ];

    const tree = buildCommentTree(comments);
    expect(tree).toHaveLength(1);
    expect(tree[0].children[0].children[0].children[0].id).toBe('c4');
  });

  it('handles multiple root comments with children', () => {
    const comments: FlatComment[] = [
      makeComment({ id: 'c1', content: 'root A' }),
      makeComment({ id: 'c2', content: 'root B' }),
      makeComment({ id: 'c3', content: 'child of A', parent_id: 'c1' }),
      makeComment({ id: 'c4', content: 'child of B', parent_id: 'c2' }),
      makeComment({ id: 'c5', content: 'another child of A', parent_id: 'c1' }),
    ];

    const tree = buildCommentTree(comments);
    expect(tree).toHaveLength(2);
    expect(tree[0].children).toHaveLength(2);
    expect(tree[1].children).toHaveLength(1);
  });

  it('treats orphan comments (unknown parent_id) as roots', () => {
    const comments: FlatComment[] = [
      makeComment({ id: 'c1', content: 'orphan', parent_id: 'nonexistent' }),
      makeComment({ id: 'c2', content: 'root' }),
    ];

    const tree = buildCommentTree(comments);
    expect(tree).toHaveLength(2);
  });

  it('preserves comment properties in tree nodes', () => {
    const comments: FlatComment[] = [
      makeComment({
        id: 'c1',
        user_id: 'u-abc',
        username: 'jankowalski',
        content: 'Great post!',
        reactions: { like: 3, heart: 1 },
        my_reaction: 'like',
        created_at: '2026-03-16T14:00:00Z',
      }),
    ];

    const tree = buildCommentTree(comments);
    expect(tree[0]).toMatchObject({
      id: 'c1',
      user_id: 'u-abc',
      username: 'jankowalski',
      content: 'Great post!',
      reactions: { like: 3, heart: 1 },
      my_reaction: 'like',
    });
  });
});

describe('countComments', () => {
  it('returns 0 for empty tree', () => {
    expect(countComments([])).toBe(0);
  });

  it('counts flat comments', () => {
    const tree = buildCommentTree([
      makeComment({ id: 'c1' }),
      makeComment({ id: 'c2' }),
      makeComment({ id: 'c3' }),
    ]);
    expect(countComments(tree)).toBe(3);
  });

  it('counts nested comments', () => {
    const tree = buildCommentTree([
      makeComment({ id: 'c1' }),
      makeComment({ id: 'c2', parent_id: 'c1' }),
      makeComment({ id: 'c3', parent_id: 'c2' }),
    ]);
    expect(countComments(tree)).toBe(3);
  });

  it('counts a complex tree correctly', () => {
    const tree = buildCommentTree([
      makeComment({ id: 'c1' }),
      makeComment({ id: 'c2', parent_id: 'c1' }),
      makeComment({ id: 'c3', parent_id: 'c1' }),
      makeComment({ id: 'c4' }),
      makeComment({ id: 'c5', parent_id: 'c4' }),
    ]);
    expect(countComments(tree)).toBe(5);
  });
});
