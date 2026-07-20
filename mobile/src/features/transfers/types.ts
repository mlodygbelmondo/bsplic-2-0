export interface MoneyTransferRecipient {
  id: string;
  username: string;
  avatar_url: string | null;
}

export interface MoneyTransferResult {
  id: string;
  amount: number;
  recipient_username: string;
  balance_after: number;
  created_at: string;
}

export interface MoneyTransferHistoryEntry {
  id: string;
  direction: 'sent' | 'received';
  counterparty_id: string | null;
  counterparty_username: string;
  counterparty_avatar_url: string | null;
  counterparty_deleted: boolean;
  amount: number;
  message: string | null;
  created_at: string;
}
