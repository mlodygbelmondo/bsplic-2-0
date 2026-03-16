import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CommentThread } from './CommentThread';
import type { FlatComment } from '../thread';

function makeComment(overrides: Partial<FlatComment> & { id: string }): FlatComment {
  return {
    user_id: 'user-1',
    username: 'jan',
    content: 'Test komentarz',
    parent_id: null,
    created_at: new Date().toISOString(),
    reactions: null,
    my_reaction: null,
    ...overrides,
  };
}

describe('CommentThread', () => {
  const defaultProps = {
    comments: [] as FlatComment[],
    onAddComment: vi.fn().mockResolvedValue(undefined),
    onToggleReaction: vi.fn(),
  };

  it('renders comment toggle button', () => {
    render(<CommentThread {...defaultProps} />);
    expect(screen.getByText('Skomentuj')).toBeInTheDocument();
  });

  it('shows comment count when comments exist', () => {
    const comments = [
      makeComment({ id: 'c1', content: 'Pierwszy' }),
      makeComment({ id: 'c2', content: 'Drugi' }),
    ];

    render(<CommentThread {...defaultProps} comments={comments} />);
    expect(screen.getByText(/2 komentarze/)).toBeInTheDocument();
  });

  it('keeps initial count label while comments are loading', () => {
    const onFirstExpand = vi.fn();

    render(
      <CommentThread
        {...defaultProps}
        comments={[]}
        initialCount={3}
        commentsLoaded={false}
        onFirstExpand={onFirstExpand}
      />
    );

    expect(screen.getByText('3 komentarze')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Pokaż komentarze/));

    expect(onFirstExpand).toHaveBeenCalledTimes(1);
    expect(screen.getByText('3 komentarze')).toBeInTheDocument();
    expect(screen.queryByText('Skomentuj')).not.toBeInTheDocument();
  });

  it('expands comments on toggle click', () => {
    const comments = [makeComment({ id: 'c1', content: 'Widoczny komentarz' })];

    render(<CommentThread {...defaultProps} comments={comments} />);

    // Comments should be collapsed initially
    expect(screen.queryByText('Widoczny komentarz')).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(screen.getByLabelText(/Pokaż komentarze/));
    expect(screen.getByText('Widoczny komentarz')).toBeInTheDocument();
  });

  it('renders nested replies with indentation', () => {
    const comments = [
      makeComment({ id: 'c1', content: 'Komentarz główny', username: 'adam' }),
      makeComment({ id: 'c2', content: 'Odpowiedź', username: 'ewa', parent_id: 'c1' }),
    ];

    render(<CommentThread {...defaultProps} comments={comments} />);
    fireEvent.click(screen.getByLabelText(/Pokaż komentarze/));

    expect(screen.getByText('Komentarz główny')).toBeInTheDocument();
    expect(screen.getByText('Odpowiedź')).toBeInTheDocument();
  });

  it('allows adding a root-level comment', async () => {
    const onAddComment = vi.fn().mockResolvedValue(undefined);
    render(<CommentThread {...defaultProps} onAddComment={onAddComment} />);

    // Expand
    fireEvent.click(screen.getByText('Skomentuj'));

    // Type and submit
    const input = screen.getByLabelText('Napisz komentarz...');
    fireEvent.change(input, { target: { value: 'Nowy komentarz' } });
    fireEvent.click(screen.getByLabelText('Wyślij komentarz'));

    await waitFor(() => {
      expect(onAddComment).toHaveBeenCalledWith('Nowy komentarz');
    });
  });

  it('allows submitting comment with Enter key', async () => {
    const onAddComment = vi.fn().mockResolvedValue(undefined);
    render(<CommentThread {...defaultProps} onAddComment={onAddComment} />);

    fireEvent.click(screen.getByText('Skomentuj'));
    const input = screen.getByLabelText('Napisz komentarz...');
    fireEvent.change(input, { target: { value: 'Enter test' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(onAddComment).toHaveBeenCalledWith('Enter test');
    });
  });

  it('shows reply button and opens reply input', async () => {
    const comments = [makeComment({ id: 'c1', content: 'Root', username: 'adam' })];

    render(<CommentThread {...defaultProps} comments={comments} />);
    fireEvent.click(screen.getByLabelText(/Pokaż komentarze/));

    const replyButton = screen.getByLabelText('Odpowiedz na komentarz adam');
    fireEvent.click(replyButton);

    expect(screen.getByLabelText('Odpowiedz @adam...')).toBeInTheDocument();
  });

  it('submits reply with parent_id', async () => {
    const onAddComment = vi.fn().mockResolvedValue(undefined);
    const comments = [makeComment({ id: 'c1', content: 'Root', username: 'adam' })];

    render(<CommentThread {...defaultProps} comments={comments} onAddComment={onAddComment} />);
    fireEvent.click(screen.getByLabelText(/Pokaż komentarze/));

    // Open reply
    fireEvent.click(screen.getByLabelText('Odpowiedz na komentarz adam'));
    const replyInput = screen.getByLabelText('Odpowiedz @adam...');
    fireEvent.change(replyInput, { target: { value: 'Moja odpowiedź' } });

    // Submit via the send button near the reply input (first enabled one)
    const sendButtons = screen.getAllByLabelText('Wyślij komentarz');
    const enabledSend = sendButtons.find((btn) => !btn.hasAttribute('disabled'));
    fireEvent.click(enabledSend!);

    await waitFor(() => {
      expect(onAddComment).toHaveBeenCalledWith('Moja odpowiedź', 'c1');
    });
  });

  it('uses correct Polish grammar for comment counts', () => {
    // 1 komentarz
    const { rerender } = render(
      <CommentThread {...defaultProps} comments={[makeComment({ id: 'c1' })]} />
    );
    expect(screen.getByText(/1 komentarz$/)).toBeInTheDocument();

    // 5 komentarzy
    rerender(
      <CommentThread
        {...defaultProps}
        comments={Array.from({ length: 5 }, (_, i) => makeComment({ id: `c${i}` }))}
      />
    );
    expect(screen.getByText(/5 komentarzy/)).toBeInTheDocument();

    // 2 komentarze
    rerender(
      <CommentThread
        {...defaultProps}
        comments={[makeComment({ id: 'c1' }), makeComment({ id: 'c2' })]}
      />
    );
    expect(screen.getByText(/2 komentarze/)).toBeInTheDocument();
  });

  it('disables input when disabled prop is true', () => {
    render(<CommentThread {...defaultProps} disabled />);
    fireEvent.click(screen.getByText('Skomentuj'));

    expect(screen.getByLabelText('Napisz komentarz...')).toBeDisabled();
  });

  it('calls onToggleReaction when reaction is clicked on a comment', () => {
    const onToggleReaction = vi.fn();
    const comments = [
      makeComment({ id: 'c1', content: 'Has reactions', reactions: { like: 2 } }),
    ];

    render(
      <CommentThread
        {...defaultProps}
        comments={comments}
        onToggleReaction={onToggleReaction}
      />
    );
    fireEvent.click(screen.getByLabelText(/Pokaż komentarze/));
    fireEvent.click(screen.getByLabelText('👍 2'));

    expect(onToggleReaction).toHaveBeenCalledWith('c1', 'like');
  });
});
