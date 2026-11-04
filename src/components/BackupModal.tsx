/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import {
  X,
  Download,
  Upload,
  Database,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  RefreshCw,
  Info,
} from 'lucide-react';
import { downloadBackupFile, inspectBackupFile, executeRestoreMerge } from '../services/backup';
import { ImportPreviewResult } from '../types';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataRestored: () => Promise<void>;
  totalTargets: number;
  totalBookmarks: number;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  onDataRestored,
  totalTargets,
  totalBookmarks,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccessMessage, setRestoreSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    setExportSuccess(false);
    try {
      await downloadBackupFile();
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 4000);
    } catch (err) {
      alert('백업 파일 내보내기 실패: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsInspecting(true);
    setRestoreSuccessMessage(null);
    try {
      const preview = await inspectBackupFile(file);
      setPreviewResult(preview);
    } finally {
      setIsInspecting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExecuteRestore = async () => {
    if (!previewResult || !previewResult.parsedData) return;

    setIsRestoring(true);
    try {
      const result = await executeRestoreMerge(previewResult.parsedData, false);
      await onDataRestored();
      setRestoreSuccessMessage(
        `복원 완료: 관심 대상 ${result.addedTargets}개 추가, 북마크 ${result.addedBookmarks}개 추가 완료!`
      );
      setPreviewResult(null);
    } catch (err) {
      alert('데이터 복원 중 오류: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">데이터 백업 및 복원</h2>
              <p className="text-xs text-slate-400">브라우저 로컬 IndexedDB 자료 보관 및 이전</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Important Notice */}
          <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-900/40 text-blue-200 text-xs flex items-start space-x-3">
            <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold block text-blue-300">데이터 보관 안내</span>
              <p className="text-slate-300 leading-relaxed">
                취업 뉴스 노트의 모든 관심 대상과 북마크는 <strong>이 브라우저의 로컬 IndexedDB에만 저장</strong>
                됩니다. 브라우저 캐시 삭제 또는 기기 변경에 대비해 정기적으로 백업 파일을 보관하세요.
              </p>
            </div>
          </div>

          {/* Current Stats */}
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium">등록된 관심 대상</span>
              <div className="text-xl font-bold text-white mt-0.5">{totalTargets}개</div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium">저장된 북마크</span>
              <div className="text-xl font-bold text-white mt-0.5">{totalBookmarks}개</div>
            </div>
          </div>

          {/* Section 1: JSON Export */}
          <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-1.5">
                  <Download className="w-4 h-4 text-blue-400" />
                  <span>JSON 파일로 내보내기 (백업)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  전체 관심 대상과 북마크 분석 결과를 표준 JSON 파일로 다운로드합니다.
                </p>
              </div>
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md transition"
              >
                {isExporting ? '생성 중...' : '백업 파일 다운로드'}
              </button>
            </div>

            {exportSuccess && (
              <div className="text-xs text-emerald-400 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>백업 파일 다운로드가 시작되었습니다. 안전한 장소에 보관하세요.</span>
              </div>
            )}
          </div>

          {/* Section 2: JSON Import */}
          <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-800 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center space-x-1.5">
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>JSON 파일에서 복원 (가져오기)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                이전에 내보낸 JSON 백업 파일을 선택하여 기존 데이터와 안전하게 병합합니다.
              </p>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isInspecting}
              className="w-full py-3 border-2 border-dashed border-slate-700 hover:border-slate-500 bg-slate-900/50 rounded-2xl text-xs font-semibold text-slate-300 hover:text-white transition flex items-center justify-center space-x-2"
            >
              {isInspecting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>파일 검증 중...</span>
                </>
              ) : (
                <>
                  <FileCheck className="w-4 h-4 text-emerald-400" />
                  <span>백업 파일 (.json) 선택하기</span>
                </>
              )}
            </button>

            {/* Import Preview Banner */}
            {previewResult && (
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-700 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-white">
                  <span>백업 파일 검증 결과</span>
                  <span
                    className={`px-2 py-0.5 rounded-full ${
                      previewResult.valid
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {previewResult.valid ? '유효한 백업 파일' : '검증 실패'}
                  </span>
                </div>

                {previewResult.valid ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                      <div className="p-2.5 rounded-xl bg-slate-800">
                        <span className="text-slate-400 text-[11px] block">관심 대상</span>
                        <strong>{previewResult.newTargetsCount}개 신규</strong> (기존 {previewResult.existingTargetsCount}개)
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-800">
                        <span className="text-slate-400 text-[11px] block">북마크</span>
                        <strong>{previewResult.newBookmarksCount}개 신규</strong> (기존 {previewResult.existingBookmarksCount}개)
                      </div>
                    </div>

                    <div className="flex justify-end space-x-2 pt-1">
                      <button
                        onClick={() => setPreviewResult(null)}
                        className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                      >
                        취소
                      </button>
                      <button
                        onClick={handleExecuteRestore}
                        disabled={isRestoring}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-sm"
                      >
                        {isRestoring ? '복원 병합 중...' : '데이터 안전 병합 실행'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-rose-300 flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{previewResult.errorMessage}</span>
                  </div>
                )}
              </div>
            )}

            {restoreSuccessMessage && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{restoreSuccessMessage}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
