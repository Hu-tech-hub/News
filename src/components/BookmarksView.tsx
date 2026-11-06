import { ArticleSummary } from './ArticleSummary';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  BookmarkCheck,
  Search,
  Filter,
  Trash2,
  ExternalLink,
  Calendar,
  Building,
  Briefcase,
  Tag,
  Download,
  Upload,
  X,
  Sparkles,
  Save,
  Clock,
  Layers,
} from 'lucide-react';
import { Bookmark } from '../types';
import { formatToKST } from '../utils/date';
import type { useSheetsSync } from '../services/useSheetsSync';

interface BookmarksViewProps {
  sheetSync?: ReturnType<typeof useSheetsSync>;
  sheetSyncConfigured?: boolean;
  bookmarks: Bookmark[];
  onDeleteBookmark: (id: string) => Promise<void>;
  onUpdateBookmarkNotes: (id: string, notes: string) => Promise<void>;
  onOpenExportModal: () => void;
  onOpenImportModal: () => void;
}

export const BookmarksView: React.FC<BookmarksViewProps> = ({
  sheetSync,
  sheetSyncConfigured,
  bookmarks,
  onDeleteBookmark,
  onUpdateBookmarkNotes,
  onOpenExportModal,
  onOpenImportModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'saved_desc' | 'published_desc'>('saved_desc');
  const [activeBookmarkModal, setActiveBookmarkModal] = useState<Bookmark | null>(null);
  const [userNoteDraft, setUserNoteDraft] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Extract unique companies, roles, industries for filters
  const uniqueCompanies = useMemo(() => {
    const set = new Set<string>();
    bookmarks.forEach((b) => set.add(b.targetSnapshot.companyName));
    return Array.from(set);
  }, [bookmarks]);

  const uniqueRoles = useMemo(() => {
    const set = new Set<string>();
    bookmarks.forEach((b) => set.add(b.targetSnapshot.jobRole));
    return Array.from(set);
  }, [bookmarks]);

  const uniqueIndustries = useMemo(() => {
    const set = new Set<string>();
    bookmarks.forEach((b) => b.industryTags.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [bookmarks]);

  // Filter and sort
  const filteredBookmarks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return bookmarks
      .filter((b) => {
        // Query search
        if (q) {
          const matchTitle = b.title.toLowerCase().includes(q);
          const matchCompany = b.targetSnapshot.companyName.toLowerCase().includes(q);
          const matchRole = b.targetSnapshot.jobRole.toLowerCase().includes(q);
          const matchTags =
            b.industryTags.some((t) => t.toLowerCase().includes(q)) ||
            b.issueTags.some((t) => t.toLowerCase().includes(q));
          const matchSummary = b.summaryItems.some((s) => s.factText.toLowerCase().includes(q));
          const matchNotes = b.userNotes?.toLowerCase().includes(q);

          if (!matchTitle && !matchCompany && !matchRole && !matchTags && !matchSummary && !matchNotes) {
            return false;
          }
        }

        // Dropdown filters
        if (selectedCompany !== 'all' && b.targetSnapshot.companyName !== selectedCompany) return false;
        if (selectedRole !== 'all' && b.targetSnapshot.jobRole !== selectedRole) return false;
        if (selectedIndustry !== 'all' && !b.industryTags.includes(selectedIndustry)) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'published_desc') {
          const timeA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
          const timeB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
          return timeB - timeA;
        }
        // Default: saved_desc
        return b.createdAt - a.createdAt;
      });
  }, [bookmarks, searchQuery, selectedCompany, selectedRole, selectedIndustry, sortBy]);

  const handleOpenDetail = (b: Bookmark) => {
    setActiveBookmarkModal(b);
    setUserNoteDraft(b.userNotes || '');
  };

  const handleSaveNotes = async () => {
    if (!activeBookmarkModal) return;
    setIsSavingNote(true);
    try {
      await onUpdateBookmarkNotes(activeBookmarkModal.id, userNoteDraft);
      setActiveBookmarkModal({
        ...activeBookmarkModal,
        userNotes: userNoteDraft,
      });
    } finally {
      setIsSavingNote(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-fadeIn">
      {sheetSync && <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3" aria-label="Google 스프레드시트 동기화">
        <h2 className="font-semibold text-sm text-white">Google 스프레드시트 동기화</h2>
        <p className="text-xs text-slate-400">북마크, 분석 결과와 메모를 전용 시트에 저장합니다. 다른 기기에서도 같은 Google 계정을 연결하면 불러올 수 있습니다.</p>
        {sheetSyncConfigured ? <div className="flex flex-wrap items-center gap-3 text-xs">
          <button type="button" disabled={!sheetSync.ready || sheetSync.busy} onClick={() => void sheetSync.connect()} className="rounded-lg bg-blue-600 px-3 py-2 text-white disabled:opacity-40">
            {sheetSync.sheetId ? 'Google 다시 연결' : 'Google 계정 연결'}
          </button>
          {sheetSync.sheetId && <>
            <a className="text-blue-300 underline" href={`https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetSync.sheetId)}/edit`} target="_blank" rel="noopener noreferrer">동기화 시트 열기</a>
            <button type="button" disabled={sheetSync.busy} onClick={() => void sheetSync.sync()} className="rounded-lg border border-slate-700 px-3 py-2 disabled:opacity-40">지금 동기화</button>
            <button type="button" disabled={sheetSync.busy} onClick={sheetSync.disconnect} className="text-slate-400">연결 해제</button>
          </>}
        </div> : <p className="text-xs text-amber-300">Google 연결을 사용하려면 이 사이트의 OAuth 클라이언트 ID 설정이 필요합니다.</p>}
        {sheetSync.message && <p role="status" className="text-xs text-slate-300">{sheetSync.message}</p>}
      </section>}
      {/* Top Header & Backup Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center space-x-2">
            <BookmarkCheck className="w-5 h-5 text-blue-400" />
            <span>내 북마크 ({bookmarks.length}개)</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            기사와 Gemini 맞춤 분석 결과를 로컬 브라우저에 안전하게 보관하고 다시 꺼내 봅니다.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onOpenExportModal}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>JSON 내보내기</span>
          </button>
          <button
            onClick={onOpenImportModal}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            <span>가져오기</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-sm">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="북마크 기사 제목, 요약 사실, 기업명, 직무, 메모 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Dropdown Filters and Sort */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          {/* Company */}
          <div>
            <label className="block text-slate-400 mb-1 font-medium">기업 필터</label>
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-200 focus:outline-none"
            >
              <option value="all">전체 기업 ({uniqueCompanies.length})</option>
              {uniqueCompanies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Role */}
          <div>
            <label className="block text-slate-400 mb-1 font-medium">직무 필터</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-200 focus:outline-none"
            >
              <option value="all">전체 직무 ({uniqueRoles.length})</option>
              {uniqueRoles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Industry */}
          <div>
            <label className="block text-slate-400 mb-1 font-medium">산업 태그</label>
            <select
              value={selectedIndustry}
              onChange={(e) => setSelectedIndustry(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-200 focus:outline-none"
            >
              <option value="all">전체 산업 ({uniqueIndustries.length})</option>
              {uniqueIndustries.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div>
            <label className="block text-slate-400 mb-1 font-medium">정렬 기준</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-200 focus:outline-none"
            >
              <option value="saved_desc">최신 저장순</option>
              <option value="published_desc">기사 발행일순</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bookmarks List */}
      {filteredBookmarks.length === 0 ? (
        <div className="p-16 rounded-3xl border border-dashed border-slate-800 bg-slate-900/40 text-center space-y-3">
          <Layers className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-300">
            {bookmarks.length === 0 ? '보관된 북마크가 없습니다' : '조건에 일치하는 북마크가 없습니다'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {bookmarks.length === 0
              ? '뉴스 찾기 탭에서 기사를 분석한 후 [북마크 보관] 버튼을 눌러 저장해 보세요.'
              : '검색어나 필터 조건을 초기화해 보세요.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredBookmarks.map((b) => (
            <div
              key={b.id}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-4 shadow-sm"
            >
              <div className="space-y-2.5">
                {/* Header Meta */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                      {b.targetSnapshot.companyName} · {b.targetSnapshot.jobRole}
                    </span>
                    {b.publisher && <span className="text-slate-400">{b.publisher}</span>}
                  </div>
                  <span className="text-slate-500 text-[11px]">
                    저장: {formatToKST(b.createdAt, 'date')}
                  </span>
                </div>

                {/* Title */}
                <h3
                  onClick={() => handleOpenDetail(b)}
                  className="text-base font-bold text-white hover:text-blue-400 cursor-pointer transition leading-snug line-clamp-2"
                >
                  {b.title}
                </h3>

                {/* Summary Snippet */}
                {b.summaryItems.length > 0 && (
                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
                    {b.summaryItems[0].factText}
                  </p>
                )}

                {/* User Notes Preview if any */}
                {b.userNotes && (
                  <div className="text-[11px] text-amber-300/90 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20 line-clamp-1">
                    메모: {b.userNotes}
                  </div>
                )}

                {/* Tags */}
                <div className="flex flex-wrap gap-1">
                  {b.industryTags.map((t) => (
                    <span key={t} className="text-[10px] text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                      #{t}
                    </span>
                  ))}
                  {b.issueTags.slice(0, 3).map((t) => (
                    <span key={t} className="text-[10px] text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded-md">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                <button
                  onClick={() => handleOpenDetail(b)}
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition"
                >
                  상세 분석 및 메모 열기 →
                </button>

                <button
                  onClick={() => {
                    if (confirm(`'${b.title}' 북마크를 삭제하시겠습니까?`)) {
                      onDeleteBookmark(b.id);
                    }
                  }}
                  title="삭제"
                  className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bookmark Detail Modal */}
      {activeBookmarkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-blue-400 uppercase">보관된 북마크 상세</span>
                <h2 className="text-lg font-bold text-white mt-0.5">{activeBookmarkModal.title}</h2>
                <div className="flex items-center space-x-3 text-xs text-slate-400 mt-1">
                  <span>기준: {activeBookmarkModal.targetSnapshot.companyName} / {activeBookmarkModal.targetSnapshot.jobRole}</span>
                  <span>|</span>
                  <span>저장일: {formatToKST(activeBookmarkModal.createdAt, 'datetime')}</span>
                </div>
              </div>
              <button
                onClick={() => setActiveBookmarkModal(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Personal Notes Box */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300">내 취업 준비 메모 (IndexedDB 로컬 저장)</span>
                  <button
                    onClick={handleSaveNotes}
                    disabled={isSavingNote}
                    className="flex items-center space-x-1 px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition"
                  >
                    <Save className="w-3 h-3" />
                    <span>{isSavingNote ? '저장 중...' : '메모 저장'}</span>
                  </button>
                </div>
                <textarea
                  rows={3}
                  placeholder="면접 질문 대비 답변 아이디어, 자소서 연계 방안 등을 기록해 보세요..."
                  value={userNoteDraft}
                  onChange={(e) => setUserNoteDraft(e.target.value)}
                  className="w-full p-2.5 bg-slate-900/80 border border-amber-500/30 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              <ArticleSummary overview={activeBookmarkModal.articleOverview} items={activeBookmarkModal.summaryItems} />

              {/* Tailored Implications */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  기업·직무 맞춤 시사점
                </h3>
                {activeBookmarkModal.implications.map((imp, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 space-y-2 text-xs">
                    <div>
                      <strong className="text-blue-400 block mb-0.5">기사 사실:</strong>
                      <span className="text-slate-200">{imp.factualBasis}</span>
                    </div>
                    <div>
                      <strong className="text-indigo-400 block mb-0.5">기업 영향:</strong>
                      <span className="text-slate-300">{imp.companyImpact}</span>
                    </div>
                    <div>
                      <strong className="text-emerald-400 block mb-0.5">직무 과제:</strong>
                      <span className="text-slate-300">{imp.jobRoleChallenge}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                      <strong className="text-amber-400">한계/확인사항:</strong> {imp.caveatsAndLimits}
                    </div>
                  </div>
                ))}
              </div>

              {/* Interview Questions */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  AI 생성 모의 면접 질문
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeBookmarkModal.interviewQuestions.map((q, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 space-y-2">
                      <h4 className="text-xs font-bold text-white">{q.question}</h4>
                      <p className="text-[11px] text-slate-400">의도: {q.intent}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
