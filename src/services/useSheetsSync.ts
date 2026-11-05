import { useEffect, useRef, useState } from 'react';
import type { Bookmark } from '../types';
import { linkedSheetKey, loadGoogleIdentity, openBookmarkSheet, requestGoogleToken, syncBookmarkSheet, type SheetConnection } from './sheetsSync';

export function useSheetsSync(clientId: string | undefined, onSynced: (bookmarks: Bookmark[]) => void) {
  const [sheetId, setSheetId] = useState<string>();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const connection = useRef<SheetConnection | null>(null);
  const running = useRef(false);
  const queued = useRef(false);
  const connecting = useRef(false);

  useEffect(() => {
    if (!clientId) return;
    let active = true;
    loadGoogleIdentity().then(() => { if (active) setReady(true); })
      .catch((error: Error) => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, [clientId]);

  async function sync() {
    const current = connection.current;
    if (!current) return;
    if (running.current) { queued.current = true; return; }
    running.current = true;
    setBusy(true);
    setMessage('북마크 동기화 중…');
    try {
      do {
        queued.current = false;
        onSynced(await syncBookmarkSheet(current));
      } while (queued.current);
      setMessage('동기화 완료');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '동기화하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  async function connect() {
    if (!clientId || connecting.current || running.current) return;
    connecting.current = true;
    setBusy(true);
    try {
      const token = await requestGoogleToken(clientId);
      const sheet = await openBookmarkSheet(token);
      connection.current = sheet;
      localStorage.setItem(linkedSheetKey, sheet.id);
      setSheetId(sheet.id);
      await sync();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Google 계정을 연결하지 못했습니다.');
    } finally {
      connecting.current = false;
      setBusy(false);
    }
  }

  function disconnect() {
    if (running.current || connecting.current) return;
    connection.current = null;
    localStorage.removeItem(linkedSheetKey);
    setSheetId(undefined);
    setMessage('연결을 해제했습니다.');
  }

  useEffect(() => {
    const resume = () => { void sync(); };
    window.addEventListener('online', resume);
    window.addEventListener('focus', resume);
    return () => {
      window.removeEventListener('online', resume);
      window.removeEventListener('focus', resume);
    };
  }, []);

  return { sheetId, ready, busy, message, connect, sync, linkedSheetId: () => localStorage.getItem(linkedSheetKey), disconnect };
}
