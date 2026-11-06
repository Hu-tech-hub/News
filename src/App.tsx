/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { SearchNewsView } from './components/SearchNewsView';
import { AnalysisView } from './components/AnalysisView';
import { BookmarksView } from './components/BookmarksView';
import { TargetManagerModal } from './components/TargetManagerModal';
import { BackupModal } from './components/BackupModal';
import { SystemStatusBar } from './components/SystemStatusBar';
import {
  AnalysisResult,
  AnalysisProgress,
  Bookmark,
  ContentStatus,
  SearchResponse,
  SearchArticleItem,
  SourceItem,
  TargetProfile,
  TimeframeOption,
} from './types';
import {
  getAllTargets,
  saveTarget,
  deleteTarget,
  getActiveTargetId,
  setActiveTargetId,
  getAllBookmarks,
  saveBookmark,
  deleteBookmark,
  findBookmarkByUrlAndTarget,
} from './services/db';
import { analyzeArticle, getSystemStatus, searchNews, SystemStatusResponse } from './services/api';
import { SEED_BOOKMARKS, SEED_TARGETS } from './utils/seed';
import { useViewNavigation } from './utils/useViewNavigation';
import { useSheetsSync } from './services/useSheetsSync';

export default function App() {
  const [activeTab, setActiveTab] = useViewNavigation();
  const [searchArticles, setSearchArticles] = useState<SearchArticleItem[]>([]);
  const [selectedSearchUrl, setSelectedSearchUrl] = useState<string | null>(null);
  const [analyzedUrls, setAnalyzedUrls] = useState<Set<string>>(new Set());
  const [resolvedArticleUrls, setResolvedArticleUrls] = useState<Record<string, string>>({});
  const [targets, setTargets] = useState<TargetProfile[]>([]);
  const [activeTarget, setActiveTarget] = useState<TargetProfile | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatusResponse | null>(null);
  const sheetSync = useSheetsSync(systemStatus?.googleSheetsClientId, setBookmarks);

  // Current active analysis state
  const [currentArticleTitle, setCurrentArticleTitle] = useState('');
  const [currentSourceUrl, setCurrentSourceUrl] = useState<string | null>(null);
  const [currentPublisher, setCurrentPublisher] = useState<string | null>(null);
  const [currentPublishedAt, setCurrentPublishedAt] = useState<string | null>(null);
  const [currentContentStatus, setCurrentContentStatus] = useState<ContentStatus>('user_provided_text');
  const [currentArticleText, setCurrentArticleText] = useState('');
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResult | null>(null);
  const [currentSources, setCurrentSources] = useState<SourceItem[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | undefined>(undefined);
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress[]>([]);
  const [analysisStartedAt, setAnalysisStartedAt] = useState(0);
  const [analysisDurationMs, setAnalysisDurationMs] = useState<number | null>(null);
  const [requestTarget, setRequestTarget] = useState<TargetProfile | null>(null);
  const analysisRequest = useRef<AbortController | null>(null);

  // Modals
  const [isTargetManagerOpen, setIsTargetManagerOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

  // Initialize DB and state
  const loadInitialData = async () => {
    try {
      const [fetchedTargets, fetchedBookmarks, savedActiveId, status] = await Promise.all([
        getAllTargets(),
        getAllBookmarks(),
        getActiveTargetId(),
        getSystemStatus().catch(() => null),
      ]);

      setTargets(fetchedTargets);
      setBookmarks(fetchedBookmarks);
      setSystemStatus(status);

      if (fetchedTargets.length > 0) {
        const found = fetchedTargets.find((t) => t.id === savedActiveId);
        setActiveTarget(found || fetchedTargets[0]);
      } else {
        setActiveTarget(null);
      }
    } catch (err) {
      console.error('Initial data load error:', err);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Set of bookmarked URLs for quick status check
  const bookmarkedUrls = useMemo(() => {
    const set = new Set<string>();
    bookmarks.forEach((b) => {
      if (b.sourceUrl) set.add(b.sourceUrl);
    });
    Object.entries(resolvedArticleUrls).forEach(([original, resolved]) => {
      if (set.has(resolved)) set.add(original);
    });
    return set;
  }, [bookmarks, resolvedArticleUrls]);

  // Is current article bookmarked?
  const isCurrentBookmarked = useMemo(() => {
    if (!currentAnalysis) return false;
    return bookmarks.some(
      (b) =>
        b.title === currentArticleTitle &&
        b.targetSnapshot.companyName === currentAnalysis.targetSnapshot.companyName &&
        b.targetSnapshot.jobRole === currentAnalysis.targetSnapshot.jobRole
    );
  }, [bookmarks, currentArticleTitle, currentAnalysis]);

  // Handle Target CRUD
  const handleSaveTarget = async (target: TargetProfile) => {
    await saveTarget(target);
    const updated = await getAllTargets();
    setTargets(updated);
    await handleSelectTarget(target);
  };

  const handleDeleteTarget = async (id: string) => {
    await deleteTarget(id);
    const updated = await getAllTargets();
    setTargets(updated);
    if (activeTarget?.id === id) {
      const nextActive = updated.length > 0 ? updated[0] : null;
      setActiveTarget(nextActive);
      await setActiveTargetId(nextActive ? nextActive.id : null);
    }
  };

  const handleSelectTarget = async (target: TargetProfile) => {
    const changed = activeTarget?.companyName !== target.companyName || activeTarget?.jobRole !== target.jobRole || JSON.stringify(activeTarget?.industryTags) !== JSON.stringify(target.industryTags);
    setActiveTarget(target);
    setIsTargetManagerOpen(false);
    if (changed && currentArticleTitle && (currentArticleText || currentSourceUrl)) {
      void handleAnalyzeArticle({ articleTitle: currentArticleTitle, articleText: currentArticleText,
        sourceUrl: currentSourceUrl, inputType: currentSourceUrl ? 'url' : 'text' }, target);
    }
    await setActiveTargetId(target.id);
  };

  // Perform Real News Search
  const handlePerformSearch = async (params: {
    companyName: string;
    jobRole: string;
    industryTags: string[];
    extraKeyword?: string;
    timeframe: TimeframeOption;
  }): Promise<SearchResponse> => {
    return await searchNews(params);
  };

  // Trigger Article Analysis
  const handleAnalyzeArticle = async (params: {
    articleTitle: string;
    articleText?: string;
    sourceUrl?: string | null;
    inputType: 'search' | 'url' | 'text';
  }, selectedTarget = activeTarget) => {
    if (!selectedTarget) {
      setIsTargetManagerOpen(true);
      return;
    }

    analysisRequest.current?.abort();
    const controller = new AbortController();
    analysisRequest.current = controller;
    setRequestTarget(selectedTarget);
    const requestStartedAt = Date.now();
    setAnalysisStartedAt(requestStartedAt);
    setAnalysisDurationMs(null);
    setAnalysisProgress([{ stage: 'receiving', elapsedMs: 0 }]);
    setCurrentAnalysis(null);
    const searchedArticle = params.sourceUrl ? searchArticles.find((article) => article.sourceUrl === params.sourceUrl || resolvedArticleUrls[article.sourceUrl] === params.sourceUrl) : undefined;
    setSelectedSearchUrl(searchedArticle?.sourceUrl || null);
    setCurrentSources([]);
    setCurrentPublisher(null);
    setCurrentPublishedAt(null);
    setActiveTab('analysis', true);
    setIsAnalyzing(true);
    setAnalysisError(undefined);
    setCurrentArticleTitle(params.articleTitle);
    setCurrentSourceUrl(params.sourceUrl || null);
    setCurrentArticleText(params.articleText || '');

    try {
      const res = await analyzeArticle({
        articleTitle: params.articleTitle,
        articleText: params.articleText,
        sourceUrl: params.sourceUrl,
        targetCompany: selectedTarget.companyName,
        targetRole: selectedTarget.jobRole,
        industryTags: selectedTarget.industryTags,
        inputType: params.inputType,
      }, (progress) => {
        if (analysisRequest.current !== controller) return;
        setAnalysisProgress((previous) => previous.some((item) => item.stage === progress.stage) ? previous : [...previous, { ...progress, elapsedMs: Date.now() - requestStartedAt }]);
      }, controller.signal);

      if (analysisRequest.current !== controller) return;

      if (res.success && (!res.analysis || res.articleText.trim().length < 50 ||
        res.analysis.targetSnapshot.companyName !== selectedTarget.companyName || res.analysis.targetSnapshot.jobRole !== selectedTarget.jobRole)) {
        throw new Error('기사 본문 또는 분석 기준이 요청과 일치하지 않아 결과를 표시하지 않았습니다. 다시 분석해 주세요.');
      }

      setCurrentSourceUrl(res.sources[0]?.url || params.sourceUrl || null);
      if (params.sourceUrl && res.sources[0]?.url) setResolvedArticleUrls((previous) => ({ ...previous, [params.sourceUrl!]: res.sources[0].url! }));
      setCurrentSources(res.sources);
      if (!res.success) {
        setCurrentArticleText(res.articleText || params.articleText || '');
        setCurrentContentStatus(res.contentStatus);
        setAnalysisError(res.errorMessage || '기사 본문을 불러오지 못했습니다.');
        return;
      }

      setCurrentContentStatus(res.contentStatus);
      setCurrentArticleText(res.articleText);
      setCurrentArticleTitle(res.articleTitle);
      if (res.analysis) {
        setCurrentAnalysis(res.analysis);
        if (params.sourceUrl) setAnalyzedUrls((previous) => new Set([...previous, params.sourceUrl!]));
      }
    } catch (err) {
      if (analysisRequest.current !== controller) return;
      setAnalysisError(err instanceof Error ? err.message : '분석 처리 중 오류가 발생했습니다.');
    } finally {
      if (analysisRequest.current === controller) {
        setAnalysisDurationMs(Date.now() - requestStartedAt);
        setIsAnalyzing(false);
      }
    }
  };

  // Re-analyze with new active target
  const handleReAnalyzeWithTarget = () => {
    if (!activeTarget) return;
    handleAnalyzeArticle({
      articleTitle: currentArticleTitle,
      articleText: currentArticleText,
      sourceUrl: currentSourceUrl,
      inputType: currentSourceUrl ? 'url' : 'text',
    });
  };

  // Load sample grounded analysis immediately to verify full UI flow
  const handleLoadSampleAnalysis = () => {
    setAnalysisDurationMs(null);
    analysisRequest.current?.abort();
    analysisRequest.current = null;
    const seed = SEED_BOOKMARKS[0];

    setCurrentArticleTitle(`[체험용 샘플] ${seed.title}`);
    setCurrentSourceUrl(seed.sourceUrl);
    setCurrentPublisher(seed.publisher);
    setCurrentPublishedAt(seed.publishedAt);
    setCurrentContentStatus('full_text_fetched');
    setCurrentArticleText(seed.articleText);
    setCurrentSources(seed.sources);
    setCurrentAnalysis({
      ...seed,
      targetSnapshot: { ...seed.targetSnapshot },
      orchestrator: 'google-adk-workflow',
    });
    setAnalysisError(undefined);
    setIsAnalyzing(false);
  };

  // Save Bookmark into IndexedDB
  const handleSaveBookmark = async () => {
    if (!currentAnalysis) return;

    // Check if duplicate bookmark already exists for this URL + Target
    const existing = await findBookmarkByUrlAndTarget(
      currentSourceUrl,
      currentAnalysis.targetSnapshot.companyName,
      currentAnalysis.targetSnapshot.jobRole
    );

    if (existing) {
      const confirmOverwrite = confirm(
        `이미 동일한 기사와 관심 대상(${existing.targetSnapshot.companyName} / ${existing.targetSnapshot.jobRole})으로 저장된 북마크가 있습니다. 기존 북마크를 최신 분석 결과로 갱신하시겠습니까?`
      );
      if (!confirmOverwrite) return;
    }

    const bookmarkId = existing ? existing.id : `bm-${Date.now()}`;
    const newBookmark: Bookmark = {
      id: bookmarkId,
      title: currentArticleTitle,
      sourceUrl: currentSourceUrl,
      canonicalUrl: currentSourceUrl,
      publisher: currentPublisher,
      publishedAt: currentPublishedAt,
      publishedDatePrecision: 'datetime',
      articleUpdatedAt: null,
      inputType: currentSourceUrl ? 'url' : 'text',
      contentStatus: currentContentStatus,
      articleText: currentArticleText,
      industryTags: currentAnalysis.industryTags,
      companyTags: currentAnalysis.companyTags,
      issueTags: currentAnalysis.issueTags,
      summaryItems: currentAnalysis.summaryItems,
      articleOverview: currentAnalysis.articleOverview,
      targetSnapshot: { ...currentAnalysis.targetSnapshot },
      implications: currentAnalysis.implications,
      interviewQuestions: currentAnalysis.interviewQuestions,
      sources: currentSources,
      uncertainties: currentAnalysis.uncertainties,
      analysisStatus: 'completed',
      analyzedAt: currentAnalysis.analyzedAt,
      modelId: currentAnalysis.modelId,
      promptVersion: currentAnalysis.promptVersion,
      createdAt: existing ? existing.createdAt : Date.now(),
      updatedAt: Date.now(),
      userNotes: existing?.userNotes || '',
    };

    await saveBookmark(newBookmark);
    const updated = await getAllBookmarks();
    setBookmarks(updated);
    void sheetSync.sync();
  };

  // Delete Bookmark
  const handleDeleteBookmark = async (id: string) => {
    await deleteBookmark(id, sheetSync.linkedSheetId());
    const updated = await getAllBookmarks();
    setBookmarks(updated);
    void sheetSync.sync();
  };

  // Update user notes on bookmark
  const handleUpdateBookmarkNotes = async (id: string, notes: string) => {
    const targetBm = bookmarks.find((b) => b.id === id);
    if (!targetBm) return;
    const updated: Bookmark = {
      ...targetBm,
      userNotes: notes,
      updatedAt: Date.now(),
    };
    await saveBookmark(updated);
    const list = await getAllBookmarks();
    setBookmarks(list);
    void sheetSync.sync();
  };

  // Load Seed Demo Data
  const handleLoadDemoData = async () => {
    setAnalysisDurationMs(null);
    for (const t of SEED_TARGETS) {
      await saveTarget(t);
    }
    for (const b of SEED_BOOKMARKS) {
      await saveBookmark(b);
    }
    await loadInitialData();
    // Also load first bookmark into analysis view for instant inspection
    const firstBm = SEED_BOOKMARKS[0];
    setCurrentArticleTitle(firstBm.title);
    setCurrentSourceUrl(firstBm.sourceUrl);
    setCurrentPublisher(firstBm.publisher);
    setCurrentPublishedAt(firstBm.publishedAt);
    setCurrentContentStatus(firstBm.contentStatus);
    setCurrentArticleText(firstBm.articleText);
    setCurrentSources(firstBm.sources);
    setCurrentAnalysis({
      industryTags: firstBm.industryTags,
      companyTags: firstBm.companyTags,
      issueTags: firstBm.issueTags,
      summaryItems: firstBm.summaryItems,
      articleOverview: firstBm.articleOverview,
      implications: firstBm.implications,
      interviewQuestions: firstBm.interviewQuestions,
      uncertainties: firstBm.uncertainties,
      targetSnapshot: firstBm.targetSnapshot,
      modelId: firstBm.modelId,
      promptVersion: firstBm.promptVersion,
      analyzedAt: firstBm.analyzedAt,
      orchestrator: 'google-adk-workflow',
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-blue-500 selection:text-white">
      {/* System Status Banner */}
      <SystemStatusBar
        status={systemStatus}
        onLoadDemoData={handleLoadDemoData}
        hasData={targets.length > 0 || bookmarks.length > 0}
      />

      {/* Main Navbar */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        targets={targets}
        activeTarget={activeTarget}
        onSelectTarget={handleSelectTarget}
        onOpenTargetManager={() => setIsTargetManagerOpen(true)}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
        bookmarkCount={bookmarks.length}
        hasAnalysis={currentAnalysis !== null}
      />

      {/* Main Views */}
      <main className="flex-1 pb-16">
        <div hidden={activeTab !== 'search'}>
          <SearchNewsView
            activeTarget={activeTarget}
            onOpenTargetManager={() => setIsTargetManagerOpen(true)}
            onAnalyzeArticle={handleAnalyzeArticle}
            bookmarkedUrls={bookmarkedUrls}
            onPerformSearch={handlePerformSearch}
            onResults={setSearchArticles}
            analyzedUrls={analyzedUrls}
          />
        </div>

        {activeTab === 'analysis' && (
          <>
          <div className="max-w-5xl mx-auto px-4 pt-5 flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={() => setActiveTab('search')} className="text-sm font-semibold text-blue-300 hover:underline">← 검색 결과로</button>
            {selectedSearchUrl && searchArticles.some((article) => article.sourceUrl === selectedSearchUrl) && (
              <div className="flex gap-3 text-xs text-slate-300">
                {([-1, 1] as const).map((offset) => {
                  const index = searchArticles.findIndex((article) => article.sourceUrl === selectedSearchUrl);
                  const article = searchArticles[index + offset];
                  return <button type="button" key={offset} disabled={!article || isAnalyzing} className="rounded-lg border border-slate-700 px-3 py-2 disabled:opacity-30" onClick={() => {
                    if (article) void handleAnalyzeArticle({ articleTitle: article.title, sourceUrl: article.sourceUrl, inputType: 'search' });
                  }}>{offset < 0 ? '이전 기사' : '다음 기사'}</button>;
                })}
              </div>
            )}
          </div>
          <AnalysisView
            articleTitle={currentArticleTitle}
            sourceUrl={currentSourceUrl}
            publisher={currentPublisher}
            publishedAt={currentPublishedAt}
            contentStatus={currentContentStatus}
            articleText={currentArticleText}
            analysis={currentAnalysis}
            sources={currentSources}
            activeTarget={isAnalyzing ? requestTarget : activeTarget}
            isAnalyzing={isAnalyzing}
            progress={analysisProgress}
            startedAt={analysisStartedAt}
            durationMs={analysisDurationMs}
            onSaveBookmark={handleSaveBookmark}
            isBookmarked={isCurrentBookmarked}
            onReAnalyzeWithTarget={handleReAnalyzeWithTarget}
            errorMessage={analysisError}
            onRetryWithCustomText={(text) => {
              handleAnalyzeArticle({
                articleTitle: currentArticleTitle,
                articleText: text,
                sourceUrl: currentSourceUrl,
                inputType: 'text',
              });
            }}
            onLoadSampleAnalysis={handleLoadSampleAnalysis}
          />
          </>
        )}

        {activeTab === 'bookmarks' && (
          <BookmarksView
            sheetSync={sheetSync}
            sheetSyncConfigured={Boolean(systemStatus?.googleSheetsClientId)}
            bookmarks={bookmarks}
            onDeleteBookmark={handleDeleteBookmark}
            onUpdateBookmarkNotes={handleUpdateBookmarkNotes}
            onOpenExportModal={() => setIsBackupModalOpen(true)}
            onOpenImportModal={() => setIsBackupModalOpen(true)}
          />
        )}
      </main>

      {/* Target Manager Modal */}
      <TargetManagerModal
        isOpen={isTargetManagerOpen}
        onClose={() => setIsTargetManagerOpen(false)}
        targets={targets}
        activeTarget={activeTarget}
        onSaveTarget={handleSaveTarget}
        onDeleteTarget={handleDeleteTarget}
        onSelectTarget={handleSelectTarget}
      />

      {/* Backup and Restore Modal */}
      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        onDataRestored={loadInitialData}
        totalTargets={targets.length}
        totalBookmarks={bookmarks.length}
      />
    </div>
  );
}
