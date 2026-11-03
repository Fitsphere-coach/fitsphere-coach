import { createSessionStorage, type KeyValueStore } from './storage';

function store(overrides: Partial<KeyValueStore> = {}): KeyValueStore {
  const values = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => values.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      values.delete(key);
    }),
    ...overrides,
  } as KeyValueStore;
}

describe('ADR-0004 rule 3: session storage', () => {
  it('ADR-0004 keeps the session in secure storage', async () => {
    const secure = store();
    const storage = createSessionStorage(secure);

    await storage.setItem('fitsphere-auth', 'session');

    expect(secure.setItemAsync).toHaveBeenCalledWith('fitsphere-auth', 'session');
    expect(await storage.getItem('fitsphere-auth')).toBe('session');
    await storage.removeItem('fitsphere-auth');
    expect(await storage.getItem('fitsphere-auth')).toBeNull();
  });

  it('ADR-0004 keeps the session in memory for this run when secure storage refuses it', async () => {
    const storage = createSessionStorage(
      store({ setItemAsync: jest.fn(async () => Promise.reject(new Error('too large'))) }),
    );

    await expect(storage.setItem('fitsphere-auth', 'session')).resolves.toBeUndefined();
    expect(await storage.getItem('fitsphere-auth')).toBe('session');
    await storage.removeItem('fitsphere-auth');
    expect(await storage.getItem('fitsphere-auth')).toBeNull();
  });

  it('ADR-0004 reads nothing, without throwing, when secure storage cannot be read', async () => {
    const storage = createSessionStorage(
      store({ getItemAsync: jest.fn(async () => Promise.reject(new Error('locked'))) }),
    );

    expect(await storage.getItem('fitsphere-auth')).toBeNull();
  });
});
