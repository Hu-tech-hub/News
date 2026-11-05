/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Navbar } from './components/Navbar';
import { SearchNewsView } from './components/SearchNewsView';
import { AnalysisView } from './components/AnalysisView';
import { BookmarksView } from './components/BookmarksView';
import { TargetManagerModal } from './components/TargetManagerModal';
import { BackupModal } from './components/BackupModal';
import { SystemStatusBar } from './components/SystemStatusBar';
import {
  AnalysisResult,
  Bookmark,
  ContentStatus,
  SearchResponse,
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

export default function App() {
  const [activeTab, setActiveTab] = useState<'search' | 'analysis' | 'bookmarks'>('search');
  const [targets, setTargets] = useState<TargetProfile[]>([]);
  const [activeTarget, setActiveTarget] = useState<TargetProfile | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatusResponse | null>(null);

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
    return set;
  }, [bookmarks]);

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
    if (!activeTarget || activeTarget.id === target.id) {
      setActiveTarget(target);
      await setActiveTargetId(target.id);
    }
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
    setActiveTarget(target);
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
  }) => {
    if (!activeTarget) {
      setIsTargetManagerOpen(true);
      return;
    }

    setActiveTab('analysis');
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
        targetCompany: activeTarget.companyName,
        targetRole: activeTarget.jobRole,
        industryTags: activeTarget.industryTags,
        inputType: params.inputType,
      });

      if (!res.success) {
        setCurrentContentStatus(res.contentStatus);
        setAnalysisError(res.errorMessage || '기사 본문을 불러오지 못했습니다.');
        return;
      }

      setCurrentContentStatus(res.contentStatus);
      setCurrentArticleText(res.articleText);
      setCurrentArticleTitle(res.articleTitle);
      setCurrentSources(res.sources);
      setCurrentSourceUrl(res.sources[0]?.url || params.sourceUrl || null);
      if (res.analysis) {
        setCurrentAnalysis(res.analysis);
      }
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : '분석 처리 중 오류가 발생했습니다.');
    } finally {
      setIsAnalyzing(false);
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
    const seed = SEED_BOOKMARKS[0];
    const targetComp = activeTarget?.companyName || '삼성전자';
    const targetRole = activeTarget?.jobRole || '반도체 공정설계 (메모리사업부)';
    const targetTags = activeTarget?.industryTags || ['반도체', '제조/장비'];

    setCurrentArticleTitle(seed.title);
    setCurrentSourceUrl(seed.sourceUrl);
    setCurrentPublisher(seed.publisher);
    setCurrentPublishedAt(seed.publishedAt);
    setCurrentContentStatus('full_text_fetched');
    setCurrentArticleText(seed.articleText);
    setCurrentSources(seed.sources);
    setCurrentAnalysis({
      ...seed,
      targetSnapshot: {
        companyName: targetComp,
        jobRole: targetRole,
        industryTags: targetTags,
      },
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
  };

  // Delete Bookmark
  const handleDeleteBookmark = async (id: string) => {
    await deleteBookmark(id);
    const updated = await getAllBookmarks();
    setBookmarks(updated);
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
  };

  // Load Seed Demo Data
  const handleLoadDemoData = async () => {
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
        {activeTab === 'search' && (
          <SearchNewsView
            activeTarget={activeTarget}
            onOpenTargetManager={() => setIsTargetManagerOpen(true)}
            onAnalyzeArticle={handleAnalyzeArticle}
            bookmarkedUrls={bookmarkedUrls}
            onPerformSearch={handlePerformSearch}
          />
        )}

        {activeTab === 'analysis' && (
          <AnalysisView
            articleTitle={currentArticleTitle}
            sourceUrl={currentSourceUrl}
            publisher={currentPublisher}
            publishedAt={currentPublishedAt}
            contentStatus={currentContentStatus}
            articleText={currentArticleText}
            analysis={currentAnalysis}
            sources={currentSources}
            activeTarget={activeTarget}
            isAnalyzing={isAnalyzing}
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
        )}

        {activeTab === 'bookmarks' && (
          <BookmarksView
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
