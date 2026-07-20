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
export const secureAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    await ensureAvailable('read', key);
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      throw new SecureAuthStorageError('read', key, error);
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    await ensureAvailable('write', key);
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      throw new SecureAuthStorageError('write', key, error);
    }
  },

  async removeItem(key: string): Promise<void> {
    await ensureAvailable('delete', key);
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      throw new SecureAuthStorageError('delete', key, error);
    }
  },
};
