import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MoneyTransferDialog from '@/features/transfers/components/MoneyTransferDialog';

const searchRecipientsMock = vi.fn();
const createTransferMock = vi.fn();
const fetchHistoryMock = vi.fn();
const fetchRulesMock = vi.fn();
const refreshProfileMock = vi.fn();
const updateProfileBalanceMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('@/features/transfers/api', () => ({
  searchMoneyTransferRecipients: (...args: unknown[]) => searchRecipientsMock(...args),
  createMoneyTransfer: (...args: unknown[]) => createTransferMock(...args),
  fetchMoneyTransferHistory: (...args: unknown[]) => fetchHistoryMock(...args),
  fetchMoneyTransferRules: (...args: unknown[]) => fetchRulesMock(...args),
}));

const eligibleRules = {
  min_amount: 1,
  max_message_length: 2000,
  max_transfers_per_hour: 5,
  min_account_age_days: 14,
  sender_eligible_at: '2025-01-15T00:00:00.000Z',
  sender_eligible: true,
  server_now: '2026-07-20T10:00:00.000Z',
};

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

const profile = {
  id: 'sender-1',
  username: 'Sender',
  avatar_url: null,
  balance: 125.5,
  current_streak: 0,
  longest_streak: 0,
  last_bet_date: null,
  last_topup_at: null,
  created_at: '2025-01-01T00:00:00.000Z',
};

function renderDialog(initialTab: 'send' | 'history' = 'send') {
  return render(
    <MoneyTransferDialog
      open
      onOpenChange={vi.fn()}
      initialTab={initialTab}
      profile={profile}
      refreshProfile={refreshProfileMock}
      updateProfileBalance={updateProfileBalanceMock}
    />,
  );
}

describe('MoneyTransferDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '11111111-1111-4111-8111-111111111111',
    );
    searchRecipientsMock.mockResolvedValue([
      { id: 'recipient-1', username: 'Odbiorca', avatar_url: null },
    ]);
    createTransferMock.mockResolvedValue({
      id: 'transfer-1',
      amount: 25.5,
      recipient_username: 'Odbiorca',
      balance_after: 100,
      created_at: '2026-07-20T10:00:00.000Z',
    });
    fetchHistoryMock.mockResolvedValue([]);
    fetchRulesMock.mockResolvedValue(eligibleRules);
    refreshProfileMock.mockResolvedValue(undefined);
    updateProfileBalanceMock.mockReset();
  });

  it('requires review and sends one idempotent transfer to a selected username', async () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText('Odbiorca'), {
      target: { value: 'Odb' },
    });

    expect(await screen.findByText('@Odbiorca')).toBeInTheDocument();
    fireEvent.click(screen.getByText('@Odbiorca'));
    fireEvent.change(screen.getByLabelText('Kwota'), {
      target: { value: '25,50' },
    });
    fireEvent.change(screen.getByLabelText(/Wiadomość/), {
      target: { value: 'Dzięki!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Dalej' }));

    expect(
      screen.getByText('Transfer zostanie wykonany natychmiast i nie można go cofnąć.'),
    ).toBeInTheDocument();
    expect(screen.getByText('100,00 zł')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /Wyślij 25,50 zł/ }),
    );

    await waitFor(() => {
      expect(createTransferMock).toHaveBeenCalledWith({
        recipientId: 'recipient-1',
        amount: 25.5,
        message: 'Dzięki!',
        idempotencyKey: '11111111-1111-4111-8111-111111111111',
      });
      expect(refreshProfileMock).toHaveBeenCalledTimes(1);
      expect(updateProfileBalanceMock).toHaveBeenCalledWith(100);
      expect(toastSuccessMock).toHaveBeenCalledWith(
        'Wysłano 25,50 zł do @Odbiorca',
      );
    });
  });

  it('shows only private transfer history returned for the signed-in user', async () => {
    fetchHistoryMock.mockResolvedValue([
      {
        id: 'transfer-2',
        direction: 'received',
        counterparty_id: 'sender-2',
        counterparty_username: 'Kolega',
        counterparty_avatar_url: null,
        counterparty_deleted: false,
        amount: 12,
        message: 'Na kupon',
        created_at: '2026-07-20T10:00:00.000Z',
      },
    ]);

    renderDialog('history');

    expect(await screen.findByText('Otrzymano od @Kolega')).toBeInTheDocument();
    expect(screen.getByText('+12,00 zł')).toBeInTheDocument();
    expect(screen.getByText('Na kupon')).toBeInTheDocument();
    expect(fetchHistoryMock).toHaveBeenCalledWith(20, 0);
  });

  it('reuses the operation id when a failed request is retried', async () => {
    createTransferMock
      .mockRejectedValueOnce(new Error('Utracono połączenie'))
      .mockResolvedValueOnce({
        id: 'transfer-1',
        amount: 10,
        recipient_username: 'Odbiorca',
        balance_after: 115.5,
        created_at: '2026-07-20T10:00:00.000Z',
      });
    renderDialog();

    fireEvent.change(screen.getByLabelText('Odbiorca'), {
      target: { value: 'Odb' },
    });
    fireEvent.click(await screen.findByText('@Odbiorca'));
    fireEvent.change(screen.getByLabelText('Kwota'), {
      target: { value: '10' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Dalej' }));

    const submit = screen.getByRole('button', { name: /Wyślij 10,00 zł/ });
    fireEvent.click(submit);
    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith('Utracono połączenie'),
    );
    fireEvent.click(submit);

    await waitFor(() => expect(createTransferMock).toHaveBeenCalledTimes(2));
    expect(createTransferMock.mock.calls[0][0].idempotencyKey).toBe(
      createTransferMock.mock.calls[1][0].idempotencyKey,
    );
  });

  it('keeps the successful transfer result when the background profile refresh fails', async () => {
    const consoleErrorMock = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    refreshProfileMock.mockRejectedValueOnce(new Error('refresh failed'));
    renderDialog();

    fireEvent.change(screen.getByLabelText('Odbiorca'), {
      target: { value: 'Odb' },
    });
    fireEvent.click(await screen.findByText('@Odbiorca'));
    fireEvent.change(screen.getByLabelText('Kwota'), {
      target: { value: '10' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Dalej' }));
    fireEvent.click(screen.getByRole('button', { name: /Wyślij 10,00 zł/ }));

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith(
        'Wysłano 10,00 zł do @Odbiorca',
      );
      expect(updateProfileBalanceMock).toHaveBeenCalledWith(100);
    });
    expect(toastErrorMock).not.toHaveBeenCalled();
    expect(consoleErrorMock).toHaveBeenCalledWith(
      'Post-transfer profile refresh failed:',
      expect.any(Error),
    );
    consoleErrorMock.mockRestore();
  });

  it('finishes a successful transfer without waiting for the profile refresh', async () => {
    let resolveRefresh: (() => void) | undefined;
    refreshProfileMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    renderDialog();

    fireEvent.change(screen.getByLabelText('Odbiorca'), {
      target: { value: 'Odb' },
    });
    fireEvent.click(await screen.findByText('@Odbiorca'));
    fireEvent.change(screen.getByLabelText('Kwota'), {
      target: { value: '10' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Dalej' }));
    fireEvent.click(screen.getByRole('button', { name: /Wyślij 10,00 zł/ }));

    await waitFor(() => expect(createTransferMock).toHaveBeenCalledTimes(1));
    const completedBeforeRefresh =
      toastSuccessMock.mock.calls.length === 1 &&
      fetchHistoryMock.mock.calls.length === 1;

    resolveRefresh?.();
    await waitFor(() => expect(fetchHistoryMock).toHaveBeenCalledTimes(1));
    expect(completedBeforeRefresh).toBe(true);
  });

  it('does not let a new account continue before the fourteen-day threshold', async () => {
    fetchRulesMock.mockResolvedValue({
      ...eligibleRules,
      sender_eligible_at: new Date(
        Date.now() + 14 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      sender_eligible: false,
    });

    render(
      <MoneyTransferDialog
        open
        onOpenChange={vi.fn()}
        profile={{ ...profile, created_at: new Date().toISOString() }}
        refreshProfile={refreshProfileMock}
        updateProfileBalance={updateProfileBalanceMock}
      />,
    );

    expect(
      await screen.findByText(/po 14 dniach od utworzenia konta/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dalej' })).toBeDisabled();
  });

  it('keeps transfers blocked until authoritative rules load', async () => {
    let resolveRules: ((value: typeof eligibleRules) => void) | undefined;
    fetchRulesMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRules = resolve;
        }),
    );

    renderDialog();

    expect(
      screen.getByRole('button', { name: 'Ładowanie zasad...' }),
    ).toBeDisabled();

    resolveRules?.(eligibleRules);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Dalej' })).toBeEnabled(),
    );
  });

  it('shows a rules error and remains blocked until retry succeeds', async () => {
    fetchRulesMock
      .mockRejectedValueOnce(new Error('Serwer zasad jest niedostępny'))
      .mockResolvedValueOnce(eligibleRules);

    renderDialog();

    expect(
      await screen.findByText('Serwer zasad jest niedostępny'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Zasady niedostępne' }),
    ).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Dalej' })).toBeEnabled(),
    );
    expect(fetchRulesMock).toHaveBeenCalledTimes(2);
  });

  it('unlocks an open dialog when the server eligibility time passes', async () => {
    const serverNow = new Date('2026-07-20T10:00:00.000Z');
    fetchRulesMock
      .mockResolvedValueOnce({
        ...eligibleRules,
        sender_eligible_at: new Date(serverNow.getTime() + 100).toISOString(),
        sender_eligible: false,
        server_now: serverNow.toISOString(),
      })
      .mockResolvedValueOnce({
        ...eligibleRules,
        sender_eligible_at: new Date(serverNow.getTime() + 100).toISOString(),
        sender_eligible: true,
        server_now: new Date(serverNow.getTime() + 150).toISOString(),
      });

    renderDialog();

    expect(await screen.findByText(/po 14 dniach od utworzenia konta/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dalej' })).toBeDisabled();
    await waitFor(
      () => expect(screen.getByRole('button', { name: 'Dalej' })).toBeEnabled(),
      { timeout: 1_000 },
    );
    expect(fetchRulesMock).toHaveBeenCalledTimes(2);
  });
});
