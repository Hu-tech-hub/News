/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BackupExportData, ImportPreviewResult, TargetProfile, Bookmark } from '../types';
import { getAllBookmarks, getAllTargets, saveBookmark, saveTarget } from './db';

const CURRENT_SCHEMA_VERSION = 1;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Creates exportable JSON payload
 */
export async function createBackupPayload(): Promise<BackupExportData> {
  const targets = await getAllTargets();
  const bookmarks = await getAllBookmarks();

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: '1.0.0',
    targets,
    bookmarks,
  };
}

/**
 * Triggers browser download of backup JSON file
 */
export async function downloadBackupFile(): Promise<void> {
  const payload = await createBackupPayload();
  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 10);

  const a = document.createElement('a');
  a.href = url;
  a.download = `job-news-notes-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Validates and previews an import JSON file without applying changes
 */
export async function inspectBackupFile(file: File): Promise<ImportPreviewResult> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      errorMessage: '백업 파일 크기는 최대 10MB 이하여야 합니다.',
      totalTargetsInFile: 0,
      newTargetsCount: 0,
      existingTargetsCount: 0,
      totalBookmarksInFile: 0,
      newBookmarksCount: 0,
      existingBookmarksCount: 0,
    };
  }

  try {
    const text = await file.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return {
        valid: false,
        errorMessage: '올바른 JSON 형식의 파일이 아닙니다.',
        totalTargetsInFile: 0,
        newTargetsCount: 0,
        existingTargetsCount: 0,
        totalBookmarksInFile: 0,
        newBookmarksCount: 0,
        existingBookmarksCount: 0,
      };
    }

    if (!data || typeof data !== 'object') {
      return {
        valid: false,
        errorMessage: '손상되었거나 잘못된 백업 파일 형식입니다.',
        totalTargetsInFile: 0,
        newTargetsCount: 0,
        existingTargetsCount: 0,
        totalBookmarksInFile: 0,
        newBookmarksCount: 0,
        existingBookmarksCount: 0,
      };
    }

    const payload = data as Partial<BackupExportData>;

    if (payload.schemaVersion !== CURRENT_SCHEMA_VERSION) {
      return {
        valid: false,
        errorMessage: `지원하지 않는 스키마 버전(${payload.schemaVersion ?? '미상'})입니다. 현재 지원 버전: ${CURRENT_SCHEMA_VERSION}`,
        totalTargetsInFile: 0,
        newTargetsCount: 0,
        existingTargetsCount: 0,
        totalBookmarksInFile: 0,
        newBookmarksCount: 0,
        existingBookmarksCount: 0,
      };
    }

    if (!Array.isArray(payload.targets) || !Array.isArray(payload.bookmarks)) {
      return {
        valid: false,
        errorMessage: '필수 데이터 항목(targets, bookmarks)이 누락되었습니다.',
        totalTargetsInFile: 0,
        newTargetsCount: 0,
        existingTargetsCount: 0,
        totalBookmarksInFile: 0,
        newBookmarksCount: 0,
        existingBookmarksCount: 0,
      };
    }

    // Compare with current local records to calculate diffs
    const currentTargets = await getAllTargets();
    const currentBookmarks = await getAllBookmarks();

    const currentTargetIds = new Set(currentTargets.map((t) => t.id));
    const currentBookmarkIds = new Set(currentBookmarks.map((b) => b.id));

    let newTargets = 0;
    let existingTargets = 0;
    for (const t of payload.targets) {
      if (t && typeof t.id === 'string' && t.companyName && t.jobRole) {
        if (currentTargetIds.has(t.id)) existingTargets++;
        else newTargets++;
      }
    }

    let newBookmarks = 0;
    let existingBookmarks = 0;
    for (const b of payload.bookmarks) {
      if (b && typeof b.id === 'string' && b.title) {
        if (currentBookmarkIds.has(b.id)) existingBookmarks++;
        else newBookmarks++;
      }
    }

    return {
      valid: true,
      schemaVersion: payload.schemaVersion,
      exportedAt: payload.exportedAt,
      totalTargetsInFile: payload.targets.length,
      newTargetsCount: newTargets,
      existingTargetsCount: existingTargets,
      totalBookmarksInFile: payload.bookmarks.length,
      newBookmarksCount: newBookmarks,
      existingBookmarksCount: existingBookmarks,
      parsedData: payload as BackupExportData,
    };
  } catch (err) {
    return {
      valid: false,
      errorMessage: err instanceof Error ? err.message : '파일 검증 중 오류가 발생했습니다.',
      totalTargetsInFile: 0,
      newTargetsCount: 0,
      existingTargetsCount: 0,
      totalBookmarksInFile: 0,
      newBookmarksCount: 0,
      existingBookmarksCount: 0,
    };
  }
}

/**
 * Merges validated backup payload into local IndexedDB
 */
export async function executeRestoreMerge(
  payload: BackupExportData,
  overwriteExisting: boolean = false
): Promise<{ addedTargets: number; updatedTargets: number; addedBookmarks: number; updatedBookmarks: number }> {
  const currentTargets = await getAllTargets();
  const currentBookmarks = await getAllBookmarks();

  const currentTargetMap = new Map(currentTargets.map((t) => [t.id, t]));
  const currentBookmarkMap = new Map(currentBookmarks.map((b) => [b.id, b]));

  let addedTargets = 0;
  let updatedTargets = 0;
  let addedBookmarks = 0;
  let updatedBookmarks = 0;

  for (const t of payload.targets) {
    if (!t || !t.id || !t.companyName || !t.jobRole) continue;
    const exists = currentTargetMap.has(t.id);
    if (!exists) {
      await saveTarget(t);
      addedTargets++;
    } else if (overwriteExisting) {
      await saveTarget(t);
      updatedTargets++;
    }
  }

  for (const b of payload.bookmarks) {
    if (!b || !b.id || !b.title) continue;
    const exists = currentBookmarkMap.has(b.id);
    if (!exists) {
      await saveBookmark(b);
      addedBookmarks++;
    } else if (overwriteExisting) {
      await saveBookmark(b);
      updatedBookmarks++;
    }
  }

  return { addedTargets, updatedTargets, addedBookmarks, updatedBookmarks };
}
