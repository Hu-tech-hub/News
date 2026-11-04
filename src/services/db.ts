/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Bookmark, TargetProfile } from '../types';

const DB_NAME = 'JobNewsNotesDB';
const DB_VERSION = 1;

interface SettingsEntry {
  key: string;
  value: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Targets store
      if (!db.objectStoreNames.contains('targets')) {
        const targetStore = db.createObjectStore('targets', { keyPath: 'id' });
        targetStore.createIndex('companyName', 'companyName', { unique: false });
        targetStore.createIndex('jobRole', 'jobRole', { unique: false });
        targetStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Bookmarks store
      if (!db.objectStoreNames.contains('bookmarks')) {
        const bookmarkStore = db.createObjectStore('bookmarks', { keyPath: 'id' });
        bookmarkStore.createIndex('createdAt', 'createdAt', { unique: false });
        bookmarkStore.createIndex('sourceUrl', 'sourceUrl', { unique: false });
        bookmarkStore.createIndex('companyName', 'targetSnapshot.companyName', { unique: false });
      }

      // Settings store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Target Profiles CRUD
export async function getAllTargets(): Promise<TargetProfile[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('targets', 'readonly');
    const store = tx.objectStore('targets');
    const request = store.getAll();
    request.onsuccess = () => {
      const results = request.result as TargetProfile[];
      results.sort((a, b) => b.createdAt - a.createdAt);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveTarget(target: TargetProfile): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('targets', 'readwrite');
    const store = tx.objectStore('targets');
    const request = store.put(target);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteTarget(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('targets', 'readwrite');
    const store = tx.objectStore('targets');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function checkDuplicateTarget(
  companyName: string,
  jobRole: string,
  excludeId?: string
): Promise<boolean> {
  const targets = await getAllTargets();
  const normComp = companyName.trim().toLowerCase();
  const normRole = jobRole.trim().toLowerCase();
  return targets.some(
    (t) =>
      t.id !== excludeId &&
      t.companyName.trim().toLowerCase() === normComp &&
      t.jobRole.trim().toLowerCase() === normRole
  );
}

// Active Target setting
export async function getActiveTargetId(): Promise<string | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');
    const request = store.get('activeTargetId');
    request.onsuccess = () => {
      const entry = request.result as SettingsEntry | undefined;
      resolve(entry ? entry.value : null);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function setActiveTargetId(targetId: string | null): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    if (!targetId) {
      store.delete('activeTargetId');
    } else {
      store.put({ key: 'activeTargetId', value: targetId });
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Bookmarks CRUD
export async function getAllBookmarks(): Promise<Bookmark[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('bookmarks', 'readonly');
    const store = tx.objectStore('bookmarks');
    const request = store.getAll();
    request.onsuccess = () => {
      const results = request.result as Bookmark[];
      // Sort by createdAt descending
      results.sort((a, b) => b.createdAt - a.createdAt);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getBookmarkById(id: string): Promise<Bookmark | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('bookmarks', 'readonly');
    const store = tx.objectStore('bookmarks');
    const request = store.get(id);
    request.onsuccess = () => resolve((request.result as Bookmark) || null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveBookmark(bookmark: Bookmark): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('bookmarks', 'readwrite');
    const store = tx.objectStore('bookmarks');
    const request = store.put(bookmark);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteBookmark(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('bookmarks', 'readwrite');
    const store = tx.objectStore('bookmarks');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function findBookmarkByUrlAndTarget(
  sourceUrl: string | null,
  companyName: string,
  jobRole: string
): Promise<Bookmark | null> {
  if (!sourceUrl) return null;
  const bookmarks = await getAllBookmarks();
  const match = bookmarks.find(
    (b) =>
      b.sourceUrl === sourceUrl &&
      b.targetSnapshot.companyName.trim().toLowerCase() === companyName.trim().toLowerCase() &&
      b.targetSnapshot.jobRole.trim().toLowerCase() === jobRole.trim().toLowerCase()
  );
  return match || null;
}
