export async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('BYOG_DB', 1);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('states')) {
        db.createObjectStore('states');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveStateToDB(romId: string, state: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('states', 'readwrite');
    const store = transaction.objectStore('states');
    const request = store.put(state, romId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function loadStateFromDB(romId: string): Promise<unknown> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('states', 'readonly');
    const store = transaction.objectStore('states');
    const request = store.get(romId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
