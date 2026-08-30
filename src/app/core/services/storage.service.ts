import { Injectable } from '@angular/core';

export abstract class StorageService {
  abstract saveState(key: string, state: unknown): Promise<void>;
  abstract loadState(key: string): Promise<unknown>;
}

@Injectable({ providedIn: 'root' })
export class IndexedDbStorageService extends StorageService {
  private async openDB(): Promise<IDBDatabase> {
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

  async saveState(key: string, state: unknown): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('states', 'readwrite');
      const store = transaction.objectStore('states');
      const request = store.put(state, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async loadState(key: string): Promise<unknown> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('states', 'readonly');
      const store = transaction.objectStore('states');
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}
