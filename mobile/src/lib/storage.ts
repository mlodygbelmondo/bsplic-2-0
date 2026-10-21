import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { createMMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

/**
 * Non-sensitive persistent storage: preferences, theme, coupon, drafts and the
 * persisted React Query cache. Keys use the web's `bsplic.` prefix.
 */
export const kv = createMMKV({ id: 'bsplic' });

const SECURE_KEY_NAME = 'bsplic.secure-kv-key';

function readOrCreateEncryptionKey(): string {
  const existing = SecureStore.getItem(SECURE_KEY_NAME);
  if (existing) return existing;
  const bytes = Crypto.getRandomBytes(16);
  const key = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  SecureStore.setItem(SECURE_KEY_NAME, key, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  return key;
}

/**
 * Sensitive storage (Supabase session). An AES-256 MMKV instance whose key
 * lives in the iOS Keychain / Android Keystore via SecureStore, so sessions
 * of any size stay encrypted at rest while reads remain synchronous.
 */
export const secureKv = createMMKV({
  id: 'bsplic-secure',
  encryptionKey: readOrCreateEncryptionKey(),
  encryptionType: 'AES-256',
});

/** zustand `persist` adapter backed by MMKV. */
export const zustandStorage: StateStorage = {
  getItem: (name) => kv.getString(name) ?? null,
  setItem: (name, value) => kv.set(name, value),
  removeItem: (name) => {
    kv.remove(name);
  },
};

export function readJson<T>(key: string): T | null {
  const raw = kv.getString(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown) {
  kv.set(key, JSON.stringify(value));
}
