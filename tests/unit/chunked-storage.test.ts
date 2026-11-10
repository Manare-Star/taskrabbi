import { createChunkedStorage, type KeyValueStore } from "../../lib/chunked-storage";

function memoryStore(limit = Infinity) {
  const values = new Map<string, string>();
  const store: KeyValueStore = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      if (value.length > limit) throw new Error(`value for ${key} is over ${limit} characters`);
      values.set(key, value);
    },
    removeItem: async (key) => {
      values.delete(key);
    },
  };
  return { store, values };
}

const KEY = "sb-project-auth-token";

describe("createChunkedStorage", () => {
  it("round-trips a value far larger than the underlying store accepts", async () => {
    const { store, values } = memoryStore(2048);
    const storage = createChunkedStorage(store);
    const session = JSON.stringify({ access_token: "a".repeat(3000), refresh_token: "r".repeat(40), user: { id: "u1" } });

    await storage.setItem(KEY, session);

    expect(await storage.getItem(KEY)).toBe(session);
    expect(Math.max(...[...values.values()].map((value) => value.length))).toBeLessThanOrEqual(2048);
  });

  it("round-trips short and empty values", async () => {
    const storage = createChunkedStorage(memoryStore().store);
    await storage.setItem(KEY, "short");
    expect(await storage.getItem(KEY)).toBe("short");
    await storage.setItem(KEY, "");
    expect(await storage.getItem(KEY)).toBe("");
  });

  it("returns null for a key that was never written", async () => {
    expect(await createChunkedStorage(memoryStore().store).getItem(KEY)).toBeNull();
  });

  it("leaves no stale pieces behind when a value shrinks", async () => {
    const { store, values } = memoryStore();
    const storage = createChunkedStorage(store, 10);
    await storage.setItem(KEY, "x".repeat(45)); // 5 pieces
    await storage.setItem(KEY, "y".repeat(12)); // 2 pieces

    expect(await storage.getItem(KEY)).toBe("y".repeat(12));
    expect([...values.keys()].sort()).toEqual([`${KEY}.0`, `${KEY}.1`, `${KEY}.chunks`]);
  });

  it("removes everything on removeItem", async () => {
    const { store, values } = memoryStore();
    const storage = createChunkedStorage(store, 10);
    await storage.setItem(KEY, "x".repeat(45));
    await storage.removeItem(KEY);

    expect(await storage.getItem(KEY)).toBeNull();
    expect(values.size).toBe(0);
  });

  it("still reads a session saved before chunking existed, then migrates it on the next write", async () => {
    const { store, values } = memoryStore();
    values.set(KEY, "legacy-session");
    const storage = createChunkedStorage(store, 10);

    expect(await storage.getItem(KEY)).toBe("legacy-session");

    await storage.setItem(KEY, "new-session-value");
    expect(values.has(KEY)).toBe(false);
    expect(await storage.getItem(KEY)).toBe("new-session-value");
  });

  it("treats a half-written value as absent instead of returning a corrupt session", async () => {
    const { store, values } = memoryStore();
    const storage = createChunkedStorage(store, 10);
    await storage.setItem(KEY, "x".repeat(45));
    values.delete(`${KEY}.2`);

    expect(await storage.getItem(KEY)).toBeNull();
  });
});
