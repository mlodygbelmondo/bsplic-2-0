import * as SecureStore from 'expo-secure-store';

export type SecureStorageOperation = 'read' | 'write' | 'delete';

export class SecureAuthStorageError extends Error {
  readonly operation: SecureStorageOperation;
  readonly storageKey: string;

  constructor(
    operation: SecureStorageOperation,
    storageKey: string,
    cause?: unknown,
  ) {
    super(`Secure auth storage ${operation} failed for key "${storageKey}"`, {
      cause,
    });
    this.name = 'SecureAuthStorageError';
    this.operation = operation;
    this.storageKey = storageKey;
  }
}

const ensureAvailable = async (
  operation: SecureStorageOperation,
  key: string,
): Promise<void> => {
  try {
    if (!(await SecureStore.isAvailableAsync())) {
      throw new Error('Expo SecureStore is unavailable on this platform');
    }
  } catch (error) {
    if (error instanceof SecureAuthStorageError) throw error;
    throw new SecureAuthStorageError(operation, key, error);
  }
};

const CHUNK_SIZE = 1_800;
const MANIFEST_PREFIX = 'bsplic-secure-chunks:v1:';
const chunkKey = (key: string, index: number) => `${key}.__chunk.${index}`;

function manifestCount(value: string | null): number | null {
  if (!value?.startsWith(MANIFEST_PREFIX)) return null;
  const count = Number(value.slice(MANIFEST_PREFIX.length));
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
}

async function removeChunks(key: string, count: number): Promise<void> {
  await Promise.all(
    Array.from({ length: count }, (_, index) =>
      SecureStore.deleteItemAsync(chunkKey(key, index)),
    ),
  );
}

export const secureAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    await ensureAvailable('read', key);
    try {
      const stored = await SecureStore.getItemAsync(key);
      const count = manifestCount(stored);
      if (count === null) return stored;
      const chunks = await Promise.all(
        Array.from({ length: count }, (_, index) =>
          SecureStore.getItemAsync(chunkKey(key, index)),
        ),
      );
      if (chunks.some((chunk) => chunk === null)) {
        throw new Error('Secure auth session is incomplete');
      }
      return chunks.join('');
    } catch (error) {
      throw new SecureAuthStorageError('read', key, error);
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    await ensureAvailable('write', key);
    try {
      const previous = await SecureStore.getItemAsync(key);
      const previousCount = manifestCount(previous) ?? 0;
      if (value.length <= CHUNK_SIZE) {
        await SecureStore.setItemAsync(key, value);
        if (previousCount > 0) await removeChunks(key, previousCount);
        return;
      }

      const chunks = Array.from(
        { length: Math.ceil(value.length / CHUNK_SIZE) },
        (_, index) => value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
      );
      await Promise.all(
        chunks.map((chunk, index) =>
          SecureStore.setItemAsync(chunkKey(key, index), chunk),
        ),
      );
      await SecureStore.setItemAsync(key, `${MANIFEST_PREFIX}${chunks.length}`);
      if (previousCount > chunks.length) {
        await Promise.all(
          Array.from({ length: previousCount - chunks.length }, (_, offset) =>
            SecureStore.deleteItemAsync(chunkKey(key, chunks.length + offset)),
          ),
        );
      }
    } catch (error) {
      throw new SecureAuthStorageError('write', key, error);
    }
  },

  async removeItem(key: string): Promise<void> {
    await ensureAvailable('delete', key);
    try {
      const stored = await SecureStore.getItemAsync(key);
      const count = manifestCount(stored) ?? 0;
      await SecureStore.deleteItemAsync(key);
      if (count > 0) await removeChunks(key, count);
    } catch (error) {
      throw new SecureAuthStorageError('delete', key, error);
    }
  },
};
