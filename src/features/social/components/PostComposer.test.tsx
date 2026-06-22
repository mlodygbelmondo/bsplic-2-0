import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { PostComposer } from './PostComposer';

const searchMentionUsersMock = vi.fn();
const compressImageFileMock = vi.fn();

vi.mock('@/features/social/api/mentions', () => ({
  searchMentionUsers: (...args: unknown[]) => searchMentionUsersMock(...args),
}));

vi.mock('@/features/social/images', () => ({
  compressImageFile: (...args: unknown[]) => compressImageFileMock(...args),
}));

describe('PostComposer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1024,
    });
    searchMentionUsersMock.mockResolvedValue([]);
    compressImageFileMock.mockResolvedValue({
      blob: new Blob(['img'], { type: 'image/jpeg' }),
      width: 800,
      height: 600,
    });
  });

  it('renders textarea and submit button', () => {
    render(<PostComposer onSubmit={vi.fn()} />);

    expect(screen.getByLabelText('Treść posta')).toBeInTheDocument();
    expect(screen.getByLabelText('Opublikuj post')).toBeInTheDocument();
  });

  it('uses the shared dark-mode surface treatment', () => {
    render(<PostComposer onSubmit={vi.fn()} />);

    expect(screen.getByLabelText('Treść posta').closest('.app-surface')).not.toBeNull();
  });

  it('opens the mobile editor in a sheet instead of expanding inline', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 390,
    });

    render(<PostComposer onSubmit={vi.fn()} />);

    const composer = screen.getByTestId('post-composer');
    const trigger = screen.getByRole('button', { name: 'Utwórz post' });

    expect(composer).toHaveAttribute('data-state', 'trigger');
    expect(screen.queryByLabelText('Treść posta')).not.toBeInTheDocument();

    fireEvent.click(trigger);

    expect(composer).toHaveAttribute('data-state', 'open');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    const textarea = screen.getByLabelText('Treść posta');

    expect(textarea).toHaveAttribute('rows', '5');
    expect(textarea).toHaveClass('text-base');
    expect(textarea).not.toHaveClass('text-sm');
  });

  it('keeps a mobile draft when the sheet closes before publishing', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 390,
    });

    render(<PostComposer onSubmit={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Utwórz post' }));

    const textarea = await screen.findByLabelText('Treść posta');
    fireEvent.change(textarea, { target: { value: 'Niedokończony draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Utwórz post' }));

    expect(await screen.findByLabelText('Treść posta')).toHaveValue(
      'Niedokończony draft',
    );
  });

  it('keeps the desktop composer at the original three rows', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1024,
    });

    render(<PostComposer onSubmit={vi.fn()} />);

    const textarea = screen.getByLabelText('Treść posta');

    expect(textarea).toHaveAttribute('rows', '3');
    expect(textarea).toHaveClass('text-sm');

    fireEvent.blur(textarea);

    expect(textarea).toHaveAttribute('rows', '3');
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

  it('shows mention suggestions and inserts selected mention', async () => {
    searchMentionUsersMock.mockResolvedValue([
      { id: 'user-2', username: 'tester' },
      { id: 'user-3', username: 'testowy' },
    ]);

    render(<PostComposer onSubmit={vi.fn()} currentUserId="user-1" />);

    const textarea = screen.getByLabelText('Treść posta');
    fireEvent.change(textarea, {
      target: { value: 'Hej @te' },
    });

    await waitFor(() => {
      expect(searchMentionUsersMock).toHaveBeenCalledWith('te', 'user-1');
    });

    const suggestion = await screen.findByRole('button', { name: '@tester' });
    fireEvent.click(suggestion);

    expect(textarea).toHaveValue('Hej @tester ');
  });

});
