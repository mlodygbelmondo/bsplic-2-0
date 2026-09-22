interface ResolveReplyActorInput {
  retry: boolean;
  authenticatedUserId: string;
  assertAdmin: () => Promise<void>;
  loadSourceUserId: () => Promise<string | null>;
}

export async function resolveReplyActorId({
  retry,
  authenticatedUserId,
  assertAdmin,
  loadSourceUserId,
}: ResolveReplyActorInput): Promise<
  { status: 'ok'; userId: string } | { status: 'forbidden' }
> {
  if (!retry) {
    return { status: 'ok', userId: authenticatedUserId };
  }

  try {
    await assertAdmin();
  } catch {
    return { status: 'forbidden' };
  }

  const sourceUserId = await loadSourceUserId();
  if (!sourceUserId) {
    throw new Error('Social bot source not found');
  }

  return { status: 'ok', userId: sourceUserId };
}
