import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SocialContentBlock } from '@/features/social/components/SocialContentBlock';

vi.mock('@/features/social/images', () => ({
  getSocialImageUrl: (path: string) => `https://example.com/${path}`,
}));

describe('SocialContentBlock', () => {
  it('highlights mention and links to profile route', () => {
    render(
      <MemoryRouter>
        <SocialContentBlock content="Hej @tester, co tam?" imageAlt="image" />
      </MemoryRouter>,
    );

    const mention = screen.getByRole('link', { name: '@tester' });
    expect(mention).toHaveAttribute('href', '/profile/tester');
  });

  it('renders plain URL as clickable external link', () => {
    render(
      <MemoryRouter>
        <SocialContentBlock content="Sprawdź https://example.com/test" imageAlt="image" />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: 'https://example.com/test' });
    expect(link).toHaveAttribute('href', 'https://example.com/test');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer noopener');
  });

  it('renders image when content contains image marker', () => {
    render(
      <MemoryRouter>
        <SocialContentBlock content={'Treść\n[[img:user-1/photo.jpg]]'} imageAlt="image" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('img', { name: 'image' })).toBeInTheDocument();
  });

  it('renders youtube iframe for supported youtube links', () => {
    render(
      <MemoryRouter>
        <SocialContentBlock content="https://www.youtube.com/watch?v=dQw4w9WgXcQ" imageAlt="image" />
      </MemoryRouter>,
    );

    expect(screen.getByTitle('Osadzony film YouTube')).toBeInTheDocument();
  });

  it('renders spotify iframe for supported spotify links', () => {
    render(
      <MemoryRouter>
        <SocialContentBlock content="https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC" imageAlt="image" />
      </MemoryRouter>,
    );

    expect(screen.getByTitle('Osadzony odtwarzacz Spotify')).toBeInTheDocument();
  });
});
