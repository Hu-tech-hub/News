import assert from 'node:assert/strict';
import { test } from 'node:test';
import { IDBFactory } from 'fake-indexeddb';
import { deleteBookmark, getAllBookmarks, saveBookmark } from './db';
import { syncBookmarkSheet } from './sheetsSync';
import { SEED_BOOKMARKS } from '../utils/seed';

test('syncs a bookmark across devices, imports a sheet note, and propagates deletion', async (t) => {
  const firstDevice = { indexedDB: new IDBFactory() };
  const secondDevice = { indexedDB: new IDBFactory() };
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const switchDevice = (device: typeof firstDevice) => Object.defineProperty(globalThis, 'window', { configurable: true, value: device });
  t.after(() => {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  });
  const rows: string[][] = [];
  t.mock.method(globalThis, 'fetch', async (url: string, options?: RequestInit) => {
    assert.match(url, /sheets.googleapis.com/);
    if (options?.method !== 'GET') {
      assert.match(url, /valueInputOption=RAW/);
      rows.push(...JSON.parse(String(options?.body)).values);
      return Response.json({});
    }
    return Response.json({ values: rows });
  });
  const connection = { id: 'test-sheet', token: 'test-token', expiresAt: Date.now() + 60_000, range: "'Sheet1'!A1:Z" };
  const bookmark = { ...SEED_BOOKMARKS[0], updatedAt: Date.now() - 10_000, userNotes: '=로 시작하는 메모' };
  switchDevice(firstDevice);
  await saveBookmark(bookmark);
  await syncBookmarkSheet(connection);
  assert.equal(rows.length, 2);
  switchDevice(secondDevice);
  assert.deepEqual(await syncBookmarkSheet(connection), [bookmark]);
  assert.equal(rows.length, 2);
  rows[1][12] = '시트에서 수정한 메모';
  assert.equal((await syncBookmarkSheet(connection))[0].userNotes, rows[1][12]);
  switchDevice(firstDevice);
  assert.equal((await syncBookmarkSheet(connection))[0].userNotes, '시트에서 수정한 메모');
  await new Promise((resolve) => setTimeout(resolve, 5));
  await deleteBookmark(bookmark.id, connection.id);
  await syncBookmarkSheet(connection);
  switchDevice(secondDevice);
  assert.deepEqual(await syncBookmarkSheet(connection), []);
  assert.deepEqual(await getAllBookmarks(), []);
  assert.equal(rows.at(-1)?.[2], '삭제');
});
