import type { Bookmark } from '../types';
import { getAllBookmarks, getSheetDeletions, mergeSheetBookmarks } from './db';

export interface SheetConnection {
  token: string;
  expiresAt: number;
  id: string;
  range: string;
}

export interface BookmarkVersion {
  id: string;
  updatedAt: number;
  bookmark: Bookmark | null;
  sheetNote?: string;
}

type TokenResponse = { access_token?: string; expires_in?: number; scope?: string; error?: string };
type GoogleIdentity = {
  initTokenClient(options: {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback: () => void;
  }): { requestAccessToken(options: { prompt: string }): void };
};

const scope = 'https://www.googleapis.com/auth/drive.file';
const drive = 'https://www.googleapis.com/drive/v3/files';
const sheets = 'https://sheets.googleapis.com/v4/spreadsheets';
const header = ['북마크 ID', '수정 시각', '상태', '기사 제목', '언론사', '발행일', 'URL', '기업', '직무', '핵심 요약', '직무 시사점', '면접 질문과 답변', '메모', '앱 데이터'];
const marker = { newsNotes: 'bookmark-sync-v1' };
export const linkedSheetKey = 'news-notes-linked-sheet';

function identity() {
  return (window as Window & { google?: { accounts: { oauth2: GoogleIdentity } } }).google?.accounts.oauth2;
}

let loadingIdentity: Promise<void> | undefined;
export function loadGoogleIdentity() {
  if (identity()) return Promise.resolve();
  if (!loadingIdentity) {
    loadingIdentity = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = () => identity() ? resolve() : reject(new Error('Google 로그인 초기화에 실패했습니다.'));
      script.onerror = () => { script.remove(); reject(new Error('Google 로그인 도구를 불러오지 못했습니다.')); };
      document.head.append(script);
    }).catch((error) => { loadingIdentity = undefined; throw error; });
  }
  return loadingIdentity;
}

export function requestGoogleToken(clientId: string) {
  return new Promise<{ token: string; expiresAt: number }>((resolve, reject) => {
    const oauth = identity();
    if (!oauth) { reject(new Error('Google 로그인이 아직 준비되지 않았습니다. 다시 눌러주세요.')); return; }
    oauth.initTokenClient({
      client_id: clientId,
      scope,
      callback: (response) => {
        if (!response.access_token || !response.scope?.split(' ').includes(scope)) {
          reject(new Error('스프레드시트 접근 권한을 허용해 주세요.'));
          return;
        }
        resolve({ token: response.access_token, expiresAt: Date.now() + Number(response.expires_in || 3600) * 1000 });
      },
      error_callback: () => reject(new Error('Google 로그인 창이 닫혔거나 차단됐습니다.')),
    }).requestAccessToken({ prompt: 'select_account' });
  });
}

async function googleRequest<T>(token: string, url: string, method = 'GET', data?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(data ? { 'Content-Type': 'application/json' } : {}) },
    body: data ? JSON.stringify(data) : undefined,
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Google 로그인이 만료됐습니다. 다시 연결해 주세요.');
    throw new Error(`Google 시트 요청 실패 (HTTP ${res.status}). Sheets API와 Drive API 설정, 시트 접근 권한을 확인해 주세요.`);
  }
  return res.json();
}

export async function openBookmarkSheet(auth: Pick<SheetConnection, 'token' | 'expiresAt'>): Promise<SheetConnection> {
  const query = new URLSearchParams({
    q: "trashed = false and mimeType = 'application/vnd.google-apps.spreadsheet' and 'me' in owners and appProperties has { key='newsNotes' and value='bookmark-sync-v1' }",
    orderBy: 'createdTime',
    fields: 'files(id)',
    pageSize: '10',
  });
  const list = await googleRequest<{ files?: { id: string }[] }>(auth.token, `${drive}?${query}`);
  const file = list.files?.[0] || await googleRequest<{ id: string }>(auth.token, `${drive}?fields=id`, 'POST', {
    name: '취업 뉴스 노트 · 북마크 동기화',
    mimeType: 'application/vnd.google-apps.spreadsheet',
    appProperties: marker,
  });
  const spreadsheet = await googleRequest<{ sheets: { properties: { title: string } }[] }>(
    auth.token, `${sheets}/${encodeURIComponent(file.id)}?fields=sheets(properties(title))`,
  );
  const title = spreadsheet.sheets[0].properties.title.replaceAll("'", "''");
  return { ...auth, id: file.id, range: `'${title}'!A1:Z` };
}

function toRow(version: BookmarkVersion) {
  const b = version.bookmark;
  const payload = b ? JSON.stringify(b) : '';
  const chunks = payload.match(/.{1,20000}/gsu) || [];
  if (chunks.length > 13) throw new Error('시트에 저장하기에 너무 큰 북마크가 있습니다.');
  return [
    version.id, new Date(version.updatedAt).toISOString(), b ? '저장' : '삭제',
    b?.title || '', b?.publisher || '', b?.publishedAt || '', b?.sourceUrl || '',
    b?.targetSnapshot.companyName || '', b?.targetSnapshot.jobRole || '',
    b?.summaryItems.map((item) => item.factText).join('\n').slice(0, 20_000) || '',
    b?.implications.map((item) => item.jobRoleChallenge).join('\n').slice(0, 20_000) || '',
    b?.interviewQuestions.map((item) => [item.question, item.answerGuide?.opening, ...(item.answerGuide?.keyPoints || []), item.answerGuide?.experienceTip].filter(Boolean).join('\n')).join('\n\n').slice(0, 20_000) || '',
    b?.userNotes?.slice(0, 20_000) || '', ...chunks,
  ];
}

function fromRow(row: string[]): BookmarkVersion {
  const [id, date, state] = row;
  const updatedAt = Date.parse(date);
  if (!id || !Number.isFinite(updatedAt)) throw new Error('시트의 북마크 ID 또는 수정 시각이 손상됐습니다.');
  if (state === '삭제') return { id, updatedAt, bookmark: null };
  const bookmark = JSON.parse(row.slice(13).join('')) as Bookmark;
  if (state !== '저장' || bookmark?.id !== id || bookmark.updatedAt !== updatedAt ||
    typeof bookmark.title !== 'string' || typeof bookmark.targetSnapshot?.jobRole !== 'string' ||
    typeof bookmark.targetSnapshot?.companyName !== 'string' ||
    !Array.isArray(bookmark.summaryItems) || !Array.isArray(bookmark.industryTags) ||
    !Array.isArray(bookmark.issueTags) || !Array.isArray(bookmark.interviewQuestions)) {
    throw new Error('시트의 앱 데이터가 손상됐습니다.');
  }
  return { id, updatedAt, bookmark, sheetNote: row[12] || '' };
}

export async function syncBookmarkSheet(connection: SheetConnection) {
  if (Date.now() >= connection.expiresAt) throw new Error('Google 로그인이 만료됐습니다. 다시 연결해 주세요.');
  const { token, id, range } = connection;
  const endpoint = `${sheets}/${encodeURIComponent(id)}/values/${encodeURIComponent(range)}`;
  const { values = [] } = await googleRequest<{ values?: string[][] }>(token, endpoint);
  if (!values.length) {
    const firstRow = range.replace(/A1:Z$/, 'A1:N1');
    await googleRequest(token, `${sheets}/${encodeURIComponent(id)}/values/${encodeURIComponent(firstRow)}?valueInputOption=RAW`, 'PUT', { values: [header] });
  } else if (header.some((value, index) => values[0][index] !== value)) {
    throw new Error('동기화 시트의 첫 행이 변경됐습니다. 열 제목을 복원한 뒤 다시 시도해 주세요.');
  }
  const remote = new Map<string, BookmarkVersion>();
  for (const row of values.slice(1).filter((row) => row.length)) {
    const version = fromRow(row);
    if ((remote.get(version.id)?.updatedAt ?? -1) <= version.updatedAt) remote.set(version.id, version);
  }
  const [bookmarks, tombstones] = await Promise.all([getAllBookmarks(), getSheetDeletions(id)]);
  const byId = new Map(bookmarks.map((bookmark) => [bookmark.id, bookmark]));
  const local = bookmarks.map((bookmark) => ({ id: bookmark.id, updatedAt: bookmark.updatedAt, bookmark }));
  const pending: BookmarkVersion[] = [...local, ...Object.entries(tombstones).map(([id, updatedAt]) => ({ id, updatedAt, bookmark: null }))];
  const writes = new Map<string, BookmarkVersion>();
  for (const version of pending) {
    if (version.updatedAt > Math.max(remote.get(version.id)?.updatedAt ?? -1, writes.get(version.id)?.updatedAt ?? -1)) {
      writes.set(version.id, version);
    }
  }
  for (const version of remote.values()) {
    const { bookmark, sheetNote } = version;
    if (!bookmark || sheetNote === undefined || sheetNote === (bookmark.userNotes || '').slice(0, 20_000)) continue;
    if ((tombstones[version.id] ?? -1) > version.updatedAt) continue;
    const current = byId.get(version.id);
    if (current && current.updatedAt > version.updatedAt && current.userNotes !== bookmark.userNotes && current.userNotes !== sheetNote) {
      throw new Error(`"${bookmark.title}"의 메모가 시트와 앱에서 각각 변경됐습니다. 두 메모를 확인한 후 내용을 맞춰 주세요.`);
    }
    const updatedAt = Math.max(Date.now(), version.updatedAt + 1, (current?.updatedAt || 0) + 1);
    const latest = current && current.updatedAt > version.updatedAt ? current : bookmark;
    writes.set(version.id, { id: version.id, updatedAt, bookmark: { ...latest, userNotes: sheetNote, updatedAt } });
  }
  const rows = [...writes.values()].map(toRow);
  for (let i = 0; i < rows.length; i += 5) {
    await googleRequest(token, `${endpoint}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, 'POST', { values: rows.slice(i, i + 5) });
  }
  for (const version of writes.values()) remote.set(version.id, version);
  await mergeSheetBookmarks([...remote.values()], id);
  return getAllBookmarks();
}
