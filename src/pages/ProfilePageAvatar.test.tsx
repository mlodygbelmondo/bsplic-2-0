import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProfilePage from '@/pages/ProfilePage';

const rpcMock = vi.fn();
const fromMock = vi.fn();
const storageUploadMock = vi.fn();
const storageGetPublicUrlMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const refreshProfileMock = vi.fn();
const compressImageFileMock = vi.fn();

vi.mock('@/components/Navbar', () => ({
  Navbar: () => <div>Navbar</div>,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    refreshProfile: (...args: unknown[]) => refreshProfileMock(...args),
    profile: {
      id: 'user-1',
      username: 'Tester',
      balance: 100,
      current_streak: 1,
      longest_streak: 2,
      created_at: '2026-01-01T00:00:00.000Z',
      last_bet_date: null,
      last_topup_at: null,
      avatar_url: null,
    },
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: (...args: unknown[]) => fromMock(...args),
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => storageUploadMock(...args),
        getPublicUrl: (...args: unknown[]) => storageGetPublicUrlMock(...args),
      }),
    },
  },
}));

vi.mock('@/features/social/images', () => ({
  compressImageFile: (...args: unknown[]) => compressImageFileMock(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

describe('ProfilePage avatar upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refreshProfileMock.mockResolvedValue(undefined);
    compressImageFileMock.mockResolvedValue({
      blob: new Blob(['avatar'], { type: 'image/jpeg' }),
      width: 512,
      height: 512,
    });

    rpcMock.mockImplementation((fn: string) => {
      if (fn === 'get_user_coupon_history') return Promise.resolve({ data: [] });
      if (fn === 'get_user_stats') {
        return Promise.resolve({
          data: [{
            id: 'user-1',
            total_bets: 0,
            won_bets: 0,
            lost_bets: 0,
            win_rate: 0,
            total_profit: 0,
          }],
        });
      }
      return Promise.resolve({ data: null });
    });

    fromMock.mockImplementation((table: string) => {
      if (table === 'badges') {
        return {
          select: () => ({
            eq: async () => ({ data: [] }),
          }),
        };
      }

      if (table === 'profiles') {
        return {
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        };
      }

      return {
        select: () => ({
          eq: async () => ({ data: [] }),
        }),
      };
    });

    storageUploadMock.mockResolvedValue({ error: null });
    storageGetPublicUrlMock.mockReturnValue({ data: { publicUrl: 'https://cdn.example/avatar.jpg' } });
  });

  it('uploads selected image and updates profile avatar', async () => {
    render(
      <MemoryRouter initialEntries={['/profile']}>
        <Routes>
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>,
    );

    const input = await screen.findByLabelText('Wybierz zdjęcie profilowe');
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(storageUploadMock).toHaveBeenCalled();
      expect(fromMock).toHaveBeenCalledWith('profiles');
      expect(toastSuccessMock).toHaveBeenCalledWith('Zdjęcie profilowe zaktualizowane');
    });
  });
});
