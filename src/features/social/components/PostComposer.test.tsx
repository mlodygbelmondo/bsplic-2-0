import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PostComposer } from './PostComposer';

describe('PostComposer', () => {
  it('renders textarea and submit button', () => {
    render(<PostComposer onSubmit={vi.fn()} />);

    expect(screen.getByLabelText('Treść posta')).toBeInTheDocument();
    expect(screen.getByLabelText('Opublikuj post')).toBeInTheDocument();
  });

  it('disables submit when content is empty', () => {
    render(<PostComposer onSubmit={vi.fn()} />);

    const button = screen.getByLabelText('Opublikuj post');
    expect(button).toBeDisabled();
  });

  it('enables submit when content is entered', () => {
    render(<PostComposer onSubmit={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Treść posta'), {
      target: { value: 'Mój pierwszy post!' },
    });

    expect(screen.getByLabelText('Opublikuj post')).not.toBeDisabled();
  });

  it('calls onSubmit with trimmed content', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<PostComposer onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Treść posta'), {
      target: { value: '  Hello world  ' },
    });
    fireEvent.click(screen.getByLabelText('Opublikuj post'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('Hello world');
    });
  });

  it('clears textarea after successful submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<PostComposer onSubmit={onSubmit} />);

    const textarea = screen.getByLabelText('Treść posta');
    fireEvent.change(textarea, { target: { value: 'Test' } });
    fireEvent.click(screen.getByLabelText('Opublikuj post'));

    await waitFor(() => {
      expect(textarea).toHaveValue('');
    });
  });

  it('shows character count', () => {
    render(<PostComposer onSubmit={vi.fn()} />);

    expect(screen.getByText('0/500')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Treść posta'), {
      target: { value: 'Hello' },
    });

    expect(screen.getByText('5/500')).toBeInTheDocument();
  });

  it('disables textarea and button when disabled prop is true', () => {
    render(<PostComposer onSubmit={vi.fn()} disabled />);

    expect(screen.getByLabelText('Treść posta')).toBeDisabled();
    expect(screen.getByLabelText('Opublikuj post')).toBeDisabled();
  });

  it('disables button while submitting', async () => {
    let resolveSubmit: () => void;
    const onSubmit = vi.fn(() => new Promise<void>((resolve) => {
      resolveSubmit = resolve;
    }));

    render(<PostComposer onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Treść posta'), {
      target: { value: 'Post' },
    });
    fireEvent.click(screen.getByLabelText('Opublikuj post'));

    // Button should be disabled while submitting
    expect(screen.getByLabelText('Opublikuj post')).toBeDisabled();

    // Resolve
    resolveSubmit!();
    await waitFor(() => {
      expect(screen.getByLabelText('Opublikuj post')).toBeDisabled(); // empty content now
    });
  });

  it('does not submit whitespace-only content', () => {
    const onSubmit = vi.fn();
    render(<PostComposer onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Treść posta'), {
      target: { value: '   ' },
    });

    expect(screen.getByLabelText('Opublikuj post')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Opublikuj post'));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
