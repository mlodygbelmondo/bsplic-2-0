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
const MANIFEST_V2_PREFIX = 'bsplic-secure-chunks:v2:';
const chunkKey = (key: string, index: number) => `${key}.__chunk.${index}`;
const generationChunkKey = (key: string, generation: string, index: number) => `${key}.__chunk.${generation}.${index}`;

interface ChunkManifest {
  generation: string;
  count: number;
}

function manifestCount(value: string | null): number | null {
  if (!value?.startsWith(MANIFEST_PREFIX)) return null;
  const count = Number(value.slice(MANIFEST_PREFIX.length));
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
}

function generationManifest(value: string | null): ChunkManifest | null {
  if (!value?.startsWith(MANIFEST_V2_PREFIX)) return null;
  try {
    const parsed = JSON.parse(value.slice(MANIFEST_V2_PREFIX.length)) as Partial<ChunkManifest>;
    return typeof parsed.generation === 'string' && Number.isSafeInteger(parsed.count) && Number(parsed.count) >= 0
      ? { generation: parsed.generation, count: Number(parsed.count) }
      : null;
  } catch { return null; }
}

async function removeChunks(key: string, count: number): Promise<void> {
  await Promise.all(
    Array.from({ length: count }, (_, index) =>
      SecureStore.deleteItemAsync(chunkKey(key, index)),
    ),
  );
}

async function removeGenerationChunks(key: string, manifest: ChunkManifest): Promise<void> {
  await Promise.all(Array.from({ length: manifest.count }, (_, index) =>
    SecureStore.deleteItemAsync(generationChunkKey(key, manifest.generation, index)),
  ));
}

export const secureAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    await ensureAvailable('read', key);
    try {
      const stored = await SecureStore.getItemAsync(key);
      const generated = generationManifest(stored);
      if (generated) {
        const chunks = await Promise.all(Array.from({ length: generated.count }, (_, index) =>
          SecureStore.getItemAsync(generationChunkKey(key, generated.generation, index)),
        ));
        if (chunks.some((chunk) => chunk === null)) throw new Error('Secure auth session is incomplete');
        return chunks.join('');
      }
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
      const previousGeneration = generationManifest(previous);
      const previousCount = manifestCount(previous) ?? 0;
      if (value.length <= CHUNK_SIZE) {
        await SecureStore.setItemAsync(key, value);
        if (previousGeneration) await removeGenerationChunks(key, previousGeneration);
        if (previousCount > 0) await removeChunks(key, previousCount);
        return;
      }

      const chunks = Array.from(
        { length: Math.ceil(value.length / CHUNK_SIZE) },
        (_, index) => value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
      );
      const generation = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      const nextManifest = { generation, count: chunks.length } satisfies ChunkManifest;
      try {
        await Promise.all(chunks.map((chunk, index) =>
          SecureStore.setItemAsync(generationChunkKey(key, generation, index), chunk),
        ));
        await SecureStore.setItemAsync(key, `${MANIFEST_V2_PREFIX}${JSON.stringify(nextManifest)}`);
      } catch (error) {
        await removeGenerationChunks(key, nextManifest).catch(() => undefined);
        throw error;
      }
      if (previousGeneration) await removeGenerationChunks(key, previousGeneration);
      if (previousCount > 0) await removeChunks(key, previousCount);
    } catch (error) {
      throw new SecureAuthStorageError('write', key, error);
    }
  },

  async removeItem(key: string): Promise<void> {
    await ensureAvailable('delete', key);
    try {
      const stored = await SecureStore.getItemAsync(key);
      const generated = generationManifest(stored);
      const count = manifestCount(stored) ?? 0;
      await SecureStore.deleteItemAsync(key);
      if (generated) await removeGenerationChunks(key, generated);
      if (count > 0) await removeChunks(key, count);
    } catch (error) {
      throw new SecureAuthStorageError('delete', key, error);
    }
  },
};
