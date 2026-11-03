import * as SecureStore from 'expo-secure-store';

// Session tokens live in the phone's secure storage (same rule as the trainee app). Expo sets no size limit
// there, so a failed write is handled instead of assumed away: the session is then kept in memory
// for this run of the app, and the user signs in again next time.

export type KeyValueStore = Pick<typeof SecureStore, 'getItemAsync' | 'setItemAsync' | 'deleteItemAsync'>;

export function createSessionStorage(store: KeyValueStore = SecureStore) {
  const memory = new Map<string, string>();
  return {
    async getItem(key: string): Promise<string | null> {
      const kept = memory.get(key);
      if (kept !== undefined) return kept;
      try {
        return await store.getItemAsync(key);
      } catch {
        return null;
      }
    },
    async setItem(key: string, value: string): Promise<void> {
      try {
        await store.setItemAsync(key, value);
        memory.delete(key);
      } catch {
        memory.set(key, value);
      }
    },
    async removeItem(key: string): Promise<void> {
      memory.delete(key);
      try {
        await store.deleteItemAsync(key);
      } catch {
        // Nothing more can be done; the next read returns what the store holds.
      }
    },
  };
}
