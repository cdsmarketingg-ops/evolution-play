import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'EvolutionPlayDB';
const STORE_NAME = 'soundfonts';

export interface SavedSoundFont {
  id: string;
  name: string;
  data: ArrayBuffer;
  timestamp: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export const soundFontStorage = {
  async save(name: string, data: ArrayBuffer): Promise<string> {
    const db = await getDB();
    const id = `sf_${Date.now()}`;
    const entry: SavedSoundFont = {
      id,
      name,
      data,
      timestamp: Date.now(),
    };
    await db.put(STORE_NAME, entry);
    return id;
  },

  async getAll(): Promise<SavedSoundFont[]> {
    const db = await getDB();
    return db.getAll(STORE_NAME);
  },

  async delete(id: string): Promise<void> {
    const db = await getDB();
    await db.delete(STORE_NAME, id);
  },

  async getById(id: string): Promise<SavedSoundFont | undefined> {
    const db = await getDB();
    return db.get(STORE_NAME, id);
  }
};
