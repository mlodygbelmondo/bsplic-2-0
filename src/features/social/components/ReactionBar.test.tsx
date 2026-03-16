import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ReactionBar } from './ReactionBar';
import type { ReactionCounts, ReactionType } from '../reactions';

describe('ReactionBar', () => {
  const defaultProps = {
    reactions: null as ReactionCounts | null,
    myReaction: null as ReactionType | null,
    onToggle: vi.fn(),
  };

  it('renders reaction picker when no reactions exist', () => {
    render(<ReactionBar {...defaultProps} />);

    // Should show 6 emoji picker buttons
    expect(screen.getByRole('group', { name: 'Reakcje' })).toBeInTheDocument();
    expect(screen.getByLabelText('👍')).toBeInTheDocument();
    expect(screen.getByLabelText('❤️')).toBeInTheDocument();
  });

  it('renders existing reactions with counts', () => {
    render(
      <ReactionBar
        {...defaultProps}
        reactions={{ like: 3, heart: 1 }}
      />
    );

    expect(screen.getByLabelText('👍 3')).toBeInTheDocument();
    expect(screen.getByLabelText('❤️ 1')).toBeInTheDocument();
  });

  it('highlights user\'s own reaction', () => {
    render(
      <ReactionBar
        {...defaultProps}
        reactions={{ like: 3 }}
        myReaction="like"
      />
    );

    const button = screen.getByLabelText('👍 3');
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onToggle when an existing reaction is clicked', () => {
    const onToggle = vi.fn();
    render(
      <ReactionBar
        {...defaultProps}
        reactions={{ like: 3 }}
        onToggle={onToggle}
      />
    );

    fireEvent.click(screen.getByLabelText('👍 3'));
    expect(onToggle).toHaveBeenCalledWith('like');
  });

  it('calls onToggle when a picker emoji is clicked', () => {
    const onToggle = vi.fn();
    render(
      <ReactionBar
        {...defaultProps}
        reactions={{ like: 3 }}
        onToggle={onToggle}
      />
    );

    // Heart should be in the picker since it's not in existing reactions
    fireEvent.click(screen.getByLabelText('❤️'));
    expect(onToggle).toHaveBeenCalledWith('heart');
  });

  it('disables all buttons when disabled prop is true', () => {
    render(
      <ReactionBar
        {...defaultProps}
        reactions={{ like: 1 }}
        disabled
      />
    );

    const buttons = screen.getAllByRole('button');
    buttons.forEach((button) => {
      expect(button).toBeDisabled();
    });
  });

  it('hides picker when all 6 types have counts', () => {
    render(
      <ReactionBar
        {...defaultProps}
        reactions={{ like: 1, heart: 2, laugh: 3, wow: 4, sad: 5, angry: 6 }}
      />
    );

    // All 6 buttons should be count buttons, no picker buttons
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(6);
    // Each should have a count label
    expect(screen.getByLabelText('👍 1')).toBeInTheDocument();
    expect(screen.getByLabelText('😡 6')).toBeInTheDocument();
  });

  it('shows missing types in picker for partial reactions', () => {
    render(
      <ReactionBar
        {...defaultProps}
        reactions={{ like: 5 }}
      />
    );

    // like is shown as count button, other 5 as picker buttons
    expect(screen.getByLabelText('👍 5')).toBeInTheDocument();
    expect(screen.getByLabelText('❤️')).toBeInTheDocument();
    expect(screen.getByLabelText('😂')).toBeInTheDocument();
    expect(screen.getByLabelText('😮')).toBeInTheDocument();
    expect(screen.getByLabelText('😢')).toBeInTheDocument();
    expect(screen.getByLabelText('😡')).toBeInTheDocument();
  });
});
