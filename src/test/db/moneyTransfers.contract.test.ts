// @vitest-environment node
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  backdateAccount,
  createDbPool,
  createServiceClient,
  createTestUser,
  deleteTestUsers,
  getProfileBalance,
  type TestUser,
} from './dbTestClient';

// Behavioral contract tests for the money-transfer RPCs: they call the same
// interface the app calls, against a local Supabase stack. See
// src/test/db/README.md for setup.
describe('money transfer RPC contract', () => {
  let service: SupabaseClient;
  let pool: Pool;
  let sender: TestUser;
  let recipient: TestUser;

  beforeAll(async () => {
    service = createServiceClient();
    pool = createDbPool();
    sender = await createTestUser(service, 'sender');
    recipient = await createTestUser(service, 'recipient');
  }, 60_000);

  afterAll(async () => {
    if (service && pool) {
      await deleteTestUsers(service, [sender, recipient].filter(Boolean));
      await pool.end();
    }
  });

  it('rejects transfers from accounts younger than the rule threshold', async () => {
    const { error } = await sender.client.rpc('create_money_transfer', {
      p_recipient_id: recipient.id,
      p_amount: 10,
      p_message: '',
      p_idempotency_key: randomUUID(),
    });

    expect(error?.message).toMatch(/co najmniej 14 dni/);
  });

  it('reports rules with sender eligibility from the single SQL authority', async () => {
    const before = await sender.client.rpc('get_money_transfer_rules');
    expect(before.error).toBeNull();
    expect(before.data).toMatchObject({
      min_amount: 1,
      max_message_length: 2000,
      max_transfers_per_hour: 5,
      min_account_age_days: 14,
      sender_eligible: false,
    });

    await backdateAccount(pool, sender.id, 30);

    const after = await sender.client.rpc('get_money_transfer_rules');
    expect(after.error).toBeNull();
    expect(after.data).toMatchObject({ sender_eligible: true });
  });

  it('moves money atomically and idempotently', async () => {
    await backdateAccount(pool, sender.id, 30);
    const senderBefore = await getProfileBalance(pool, sender.id);
    const recipientBefore = await getProfileBalance(pool, recipient.id);
    const key = randomUUID();

    const first = await sender.client.rpc('create_money_transfer', {
      p_recipient_id: recipient.id,
      p_amount: 25.5,
      p_message: 'kontrakt',
      p_idempotency_key: key,
    });
    expect(first.error).toBeNull();
    expect(first.data).toMatchObject({
      amount: 25.5,
      balance_after: senderBefore - 25.5,
    });

    // Same idempotency key: same transfer row back, no second debit.
    const retry = await sender.client.rpc('create_money_transfer', {
      p_recipient_id: recipient.id,
      p_amount: 25.5,
      p_message: 'kontrakt',
      p_idempotency_key: key,
    });
    expect(retry.error).toBeNull();
    expect(retry.data).toMatchObject({ id: first.data.id });

    expect(await getProfileBalance(pool, sender.id)).toBeCloseTo(
      senderBefore - 25.5,
      2,
    );
    expect(await getProfileBalance(pool, recipient.id)).toBeCloseTo(
      recipientBefore + 25.5,
      2,
    );

    // Reusing the key with different parameters must be refused.
    const conflict = await sender.client.rpc('create_money_transfer', {
      p_recipient_id: recipient.id,
      p_amount: 11,
      p_message: 'inny',
      p_idempotency_key: key,
    });
    expect(conflict.error?.message).toMatch(/został już wykorzystany/);
  });

  it('rejects self-transfers and sub-minimum amounts', async () => {
    await backdateAccount(pool, sender.id, 30);

    const self = await sender.client.rpc('create_money_transfer', {
      p_recipient_id: sender.id,
      p_amount: 10,
      p_message: '',
      p_idempotency_key: randomUUID(),
    });
    expect(self.error?.message).toMatch(/do siebie/);

    const tooSmall = await sender.client.rpc('create_money_transfer', {
      p_recipient_id: recipient.id,
      p_amount: 0.5,
      p_message: '',
      p_idempotency_key: randomUUID(),
    });
    expect(tooSmall.error?.message).toMatch(/co najmniej 1,00 zł/);
  });

  it('enforces the rolling hourly transfer limit', async () => {
    const limitedSender = await createTestUser(service, 'ratelimited');
    try {
      await backdateAccount(pool, limitedSender.id, 30);

      for (let i = 0; i < 5; i += 1) {
        const { error } = await limitedSender.client.rpc(
          'create_money_transfer',
          {
            p_recipient_id: recipient.id,
            p_amount: 1,
            p_message: '',
            p_idempotency_key: randomUUID(),
          },
        );
        expect(error).toBeNull();
      }

      const sixth = await limitedSender.client.rpc('create_money_transfer', {
        p_recipient_id: recipient.id,
        p_amount: 1,
        p_message: '',
        p_idempotency_key: randomUUID(),
      });
      expect(sixth.error?.message).toMatch(/maksymalnie 5 transferów/);
    } finally {
      await deleteTestUsers(service, [limitedSender]);
    }
  }, 30_000);

  it('shows the transfer in both participants histories', async () => {
    const senderHistory = await sender.client.rpc(
      'get_money_transfer_history',
      { p_limit: 20, p_offset: 0 },
    );
    expect(senderHistory.error).toBeNull();
    expect(
      senderHistory.data.some(
        (entry: { direction: string; amount: number }) =>
          entry.direction === 'sent' && Number(entry.amount) === 25.5,
      ),
    ).toBe(true);

    const recipientHistory = await recipient.client.rpc(
      'get_money_transfer_history',
      { p_limit: 20, p_offset: 0 },
    );
    expect(recipientHistory.error).toBeNull();
    expect(
      recipientHistory.data.some(
        (entry: { direction: string; amount: number }) =>
          entry.direction === 'received' && Number(entry.amount) === 25.5,
      ),
    ).toBe(true);
  });
});
