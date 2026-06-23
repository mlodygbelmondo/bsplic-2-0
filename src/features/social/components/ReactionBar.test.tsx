import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { ReactionBar } from './ReactionBar';
import type { ReactionCounts, ReactionType } from '../reactions';

const onOpenReactorsMock = vi.fn();

describe('ReactionBar', () => {
  const defaultProps = {
    reactions: null as ReactionCounts | null,
    myReaction: null as ReactionType | null,
    onToggle: vi.fn(),
    onOpenReactors: onOpenReactorsMock,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a like action without exposing the picker by default', () => {
    render(<ReactionBar {...defaultProps} />);

    expect(screen.getByRole('group', { name: 'Reakcje' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Lubię to' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('menu', { name: 'Wybierz reakcję' })).not.toBeInTheDocument();
  });

  it('renders existing reactions with counts', () => {
    render(
      <ReactionBar
        {...defaultProps}
        reactions={{ like: 3, heart: 1 }}
      />
    );

    expect(screen.getByRole('button', { name: 'Wyświetl reakcje (4)' })).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('highlights user\'s own reaction', () => {
    render(
      <ReactionBar
        {...defaultProps}
        reactions={{ like: 3 }}
        myReaction="like"
      />
    );

    const button = screen.getByRole('button', { name: 'Lubię to' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onToggle with like when the action is clicked without an existing reaction', () => {
    const onToggle = vi.fn();
    render(
      <ReactionBar
        {...defaultProps}
        onToggle={onToggle}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Lubię to' }));
    expect(onToggle).toHaveBeenCalledWith('like');
  });

  it('calls onToggle with the current reaction when the action is clicked again', () => {
    const onToggle = vi.fn();
    render(
      <ReactionBar
        {...defaultProps}
        reactions={{ heart: 3 }}
        myReaction="heart"
        onToggle={onToggle}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Super' }));
    expect(onToggle).toHaveBeenCalledWith('heart');
  });

  it('shows "Wyświetl reakcje" and opens reactors on click', () => {
    render(
      <ReactionBar
        {...defaultProps}
        reactions={{ like: 3 }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Wyświetl reakcje (3)' }));
    expect(onOpenReactorsMock).toHaveBeenCalledTimes(1);
  });

  it('opens reaction choices on hover and calls onToggle when a picker emoji is clicked', () => {
    const onToggle = vi.fn();
    render(
      <ReactionBar
        {...defaultProps}
        reactions={{ like: 3 }}
        onToggle={onToggle}
      />
    );

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Lubię to' }));

    expect(screen.getByRole('menu', { name: 'Wybierz reakcję' })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Super'));
    expect(onToggle).toHaveBeenCalledWith('heart');
  });

  it('opens reaction choices on mobile long press without toggling like on release', () => {
    const onToggle = vi.fn();
    render(
      <ReactionBar
        {...defaultProps}
        onToggle={onToggle}
      />
    );

    const likeButton = screen.getByRole('button', { name: 'Lubię to' });
    fireEvent.pointerDown(likeButton, { pointerType: 'touch' });

    act(() => {
      vi.advanceTimersByTime(520);
    });

    expect(screen.getByRole('menu', { name: 'Wybierz reakcję' })).toBeInTheDocument();

    fireEvent.pointerUp(likeButton, { pointerType: 'touch' });
    fireEvent.click(likeButton);
    expect(onToggle).not.toHaveBeenCalledWith('like');

    fireEvent.click(screen.getByLabelText('Ogień'));
    expect(onToggle).toHaveBeenCalledWith('fire');
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

  it('keeps the picker behind the like action even when all types have counts', () => {
    render(
      <ReactionBar
        {...defaultProps}
        reactions={{ like: 1, heart: 2, laugh: 3, wow: 4, sad: 5, angry: 6, fire: 7 }}
      />
    );

    expect(screen.getByRole('button', { name: 'Wyświetl reakcje (28)' })).toBeInTheDocument();
    expect(screen.queryByRole('menu', { name: 'Wybierz reakcję' })).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Lubię to' }));

    expect(screen.getByLabelText('Wściekły')).toBeInTheDocument();
    expect(screen.getByLabelText('Ogień')).toBeInTheDocument();
  });

  it('shows every reaction type in the hover picker for partial reactions', () => {
    render(
      <ReactionBar
        {...defaultProps}
        reactions={{ like: 5 }}
      />
    );

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Lubię to' }));

    const picker = screen.getByRole('menu', { name: 'Wybierz reakcję' });

    expect(within(picker).getByLabelText('Lubię to')).toBeInTheDocument();
    expect(within(picker).getByLabelText('Super')).toBeInTheDocument();
    expect(within(picker).getByLabelText('Haha')).toBeInTheDocument();
    expect(within(picker).getByLabelText('Wow')).toBeInTheDocument();
    expect(within(picker).getByLabelText('Przykro mi')).toBeInTheDocument();
    expect(within(picker).getByLabelText('Wściekły')).toBeInTheDocument();
    expect(within(picker).getByLabelText('Ogień')).toBeInTheDocument();
  });
});
