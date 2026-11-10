// Storage for the Supabase session on top of a key-value store that limits value size.
//
// expo-secure-store (the Keychain on iOS, Keystore-encrypted preferences on Android) is the
// right place for a login session, but it rejects or warns on values over about 2 KB, and a
// Supabase session (two JWTs plus the user object) is often larger. So a value is split
// across numbered keys:
//
//   <key>.chunks  → how many pieces there are
//   <key>.0, <key>.1, ...  → the pieces
//
// A value written before this existed lives under the bare <key>; it's still read, and is
// replaced by chunks on the next write.

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

// Under SecureStore's limit with room to spare (the limit is in bytes; a session is ASCII).
const CHUNK_SIZE = 1800;

export function createChunkedStorage(store: KeyValueStore, chunkSize = CHUNK_SIZE): KeyValueStore {
  const countKey = (key: string) => `${key}.chunks`;
  const chunkKey = (key: string, index: number) => `${key}.${index}`;

  async function readCount(key: string): Promise<number> {
    const count = Number(await store.getItem(countKey(key)));
    return Number.isInteger(count) && count > 0 ? count : 0;
  }

  async function removeChunks(key: string, from: number, to: number) {
    for (let index = from; index < to; index += 1) {
      await store.removeItem(chunkKey(key, index));
    }
  }

  return {
    async getItem(key) {
      const count = await readCount(key);
      if (count === 0) return store.getItem(key);

      const pieces: string[] = [];
      for (let index = 0; index < count; index += 1) {
        const piece = await store.getItem(chunkKey(key, index));
        // A missing piece means an interrupted write: treat the session as absent rather
        // than hand back a corrupt one.
        if (piece === null) return null;
        pieces.push(piece);
      }
      return pieces.join("");
    },

    async setItem(key, value) {
      const previousCount = await readCount(key);
      const count = Math.max(1, Math.ceil(value.length / chunkSize));

      for (let index = 0; index < count; index += 1) {
        await store.setItem(chunkKey(key, index), value.slice(index * chunkSize, (index + 1) * chunkSize));
      }
      await store.setItem(countKey(key), String(count));
      await removeChunks(key, count, previousCount);
      await store.removeItem(key);
    },

    async removeItem(key) {
      const count = await readCount(key);
      await removeChunks(key, 0, count);
      await store.removeItem(countKey(key));
      await store.removeItem(key);
    },
  };
}
