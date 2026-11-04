/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Calendar,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  BookmarkCheck,
  AlertCircle,
  Link as LinkIcon,
  FileText,
  Clock,
  Layers,
  Building,
  Briefcase,
  RefreshCw,
  AlertTriangle,
  Info,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import {
  ApiQuotaError,
  SearchArticleItem,
  SearchResponse,
  TargetProfile,
  TimeframeOption,
} from '../types';
import { formatToKST } from '../utils/date';
import { ApiError } from '../services/api';
import { getSampleSearchArticles, getSampleArticleText } from '../utils/seed';

interface SearchNewsViewProps {
  activeTarget: TargetProfile | null;
  onOpenTargetManager: () => void;
  onAnalyzeArticle: (params: {
    articleTitle: string;
    articleText?: string;
    sourceUrl?: string | null;
    inputType: 'search' | 'url' | 'text';
  }) => void;
  bookmarkedUrls: Set<string>;
  onPerformSearch: (params: {
    companyName: string;
    jobRole: string;
    industryTags: string[];
    extraKeyword?: string;
    timeframe: TimeframeOption;
  }) => Promise<SearchResponse>;
}

export const SearchNewsView: React.FC<SearchNewsViewProps> = ({
  activeTarget,
  onOpenTargetManager,
  onAnalyzeArticle,
  bookmarkedUrls,
  onPerformSearch,
}) => {
  const [activeInputMode, setActiveInputMode] = useState<'search' | 'url' | 'text'>('search');
  const [timeframe, setTimeframe] = useState<TimeframeOption>('last_7_days');
  const [extraKeyword, setExtraKeyword] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [quotaError, setQuotaError] = useState<ApiQuotaError | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);

  // Synchronous ref lock to prevent duplicate rapid clicks or Enter key bounces
  const isSearchingRef = useRef(false);

  // Manual URL input state
  const [directUrl, setDirectUrl] = useState('');
  const [directUrlTitle, setDirectUrlTitle] = useState('');

  // Manual Text input state
  const [directTextTitle, setDirectTextTitle] = useState('');
  const [directTextUrl, setDirectTextUrl] = useState('');
  const [directTextContent, setDirectTextContent] = useState('');

  // Accordion open sets for related coverage
  const [expandedRelated, setExpandedRelated] = useState<Set<string>>(new Set());

  // Countdown timer effect for Retry-After
  useEffect(() => {
    if (countdownSeconds === null || countdownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [countdownSeconds]);

  const toggleRelated = (articleId: string) => {
    const next = new Set(expandedRelated);
    if (next.has(articleId)) next.delete(articleId);
    else next.add(articleId);
    setExpandedRelated(next);
  };

  const handleSearch = async (overrideTimeframe?: TimeframeOption) => {
    if (!activeTarget) {
      onOpenTargetManager();
      return;
    }

    // Guard: Drop parallel or repeated clicks immediately
    if (isSearchingRef.current || isSearching) {
      console.warn('[뉴스 찾기] 이미 요청이 진행 중이므로 중복 호출을 차단합니다.');
      return;
    }

    const tf = overrideTimeframe || timeframe;
    isSearchingRef.current = true;
    setIsSearching(true);
    setSearchError(null);
    setQuotaError(null);

    try {
      const resp = await onPerformSearch({
        companyName: activeTarget.companyName,
        jobRole: activeTarget.jobRole,
        industryTags: activeTarget.industryTags,
        extraKeyword: extraKeyword.trim(),
        timeframe: tf,
      });

      setSearchResponse(resp);
      if (overrideTimeframe) setTimeframe(overrideTimeframe);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.quotaError) {
        setQuotaError(err.quotaError);
        setSearchError(null);
        if (err.quotaError.retryAfterSeconds && err.quotaError.retryAfterSeconds > 0) {
          setCountdownSeconds(err.quotaError.retryAfterSeconds);
        } else {
          setCountdownSeconds(null);
        }
      } else {
        setSearchError(err instanceof Error ? err.message : '뉴스 검색 중 오류가 발생했습니다.');
        setQuotaError(null);
      }
    } finally {
      setIsSearching(false);
      isSearchingRef.current = false;
    }
  };

  const handleAnalyzeFromSearch = (article: SearchArticleItem) => {
    onAnalyzeArticle({
      articleTitle: article.title,
      sourceUrl: article.sourceUrl,
      inputType: 'search',
    });
  };

  const handleAnalyzeFromUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!directUrl.trim()) return;
    onAnalyzeArticle({
      articleTitle: directUrlTitle.trim() || '입력된 웹 기사',
      sourceUrl: directUrl.trim(),
      inputType: 'url',
    });
  };

  const handleAnalyzeFromText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!directTextContent.trim() || directTextContent.trim().length < 50) {
      alert('분석을 위해 최소 50자 이상의 본문 텍스트를 입력해 주세요.');
      return;
    }
    onAnalyzeArticle({
      articleTitle: directTextTitle.trim() || '직접 입력한 기사',
      sourceUrl: directTextUrl.trim() || null,
      articleText: directTextContent.trim(),
      inputType: 'text',
    });
  };

  const handleLoadSampleArticles = () => {
    const sample = getSampleSearchArticles(activeTarget);
    setSearchResponse({
      articles: sample,
      searchTimeKST: formatToKST(new Date(), 'datetime'),
      timeframe,
      queryUsed: `${activeTarget?.companyName || '삼성전자'} ${activeTarget?.jobRole || '엔지니어링'} (체험용 샘플)`,
      targetCompany: activeTarget?.companyName || '삼성전자',
      targetRole: activeTarget?.jobRole || '엔지니어링',
      excludedCountMissingDate: 0,
      excludedCountOutOfRange: 0,
      totalFoundRaw: sample.length,
      isGroundingLive: false,
      notes: 'API 429 한도 초과 시에도 기능 및 북마크를 바로 테스트해 보실 수 있도록 제공되는 체험용 샘플 기사입니다.',
    });
    setQuotaError(null);
    setSearchError(null);
  };

  const handleFillSampleDirectText = () => {
    const sample = getSampleArticleText(activeTarget);
    setActiveInputMode('text');
    setDirectTextTitle(sample.title);
    setDirectTextUrl(sample.url);
    setDirectTextContent(sample.text);
    setQuotaError(null);
  };

  if (!activeTarget) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4 shadow-inner">
          <Briefcase className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">어떤 기업과 직무를 준비하시나요?</h2>
        <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
          취업 뉴스 노트는 목표 기업과 지원 직무의 맥락에서 뉴스를 선별하고, 실무 시사점과 면접 질문을 도출합니다.
        </p>
        <button
          onClick={onOpenTargetManager}
          className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/30 transition transform hover:-translate-y-0.5"
        >
          <span>첫 관심 대상 등록하기</span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-fadeIn">
      {/* Target Status Banner */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">현재 탐색 기준</span>
            </div>
            <div className="flex items-center space-x-2 mt-0.5">
              <h2 className="text-base font-bold text-white">{activeTarget.companyName}</h2>
              <span className="text-slate-500">/</span>
              <span className="text-sm font-semibold text-slate-200">{activeTarget.jobRole}</span>
            </div>
            {activeTarget.industryTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {activeTarget.industryTags.map((tag) => (
                  <span key={tag} className="text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={onOpenTargetManager}
          className="self-start sm:self-center px-3.5 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition"
        >
          대상 변경 및 관리
        </button>
      </div>

      {/* Input Mode Selector */}
      <div className="flex border-b border-slate-800 space-x-6 text-sm font-medium">
        <button
          onClick={() => setActiveInputMode('search')}
          className={`pb-3 flex items-center space-x-2 border-b-2 transition ${
            activeInputMode === 'search'
              ? 'border-blue-500 text-blue-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Search className="w-4 h-4" />
          <span>기업·직무 뉴스 탐색</span>
        </button>

        <button
          onClick={() => setActiveInputMode('url')}
          className={`pb-3 flex items-center space-x-2 border-b-2 transition ${
            activeInputMode === 'url'
              ? 'border-blue-500 text-blue-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <LinkIcon className="w-4 h-4" />
          <span>기사 URL 직접 입력</span>
        </button>

        <button
          onClick={() => setActiveInputMode('text')}
          className={`pb-3 flex items-center space-x-2 border-b-2 transition ${
            activeInputMode === 'text'
              ? 'border-blue-500 text-blue-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>본문 직접 붙여넣기</span>
        </button>
      </div>

      {/* MODE 1: Search Form */}
      {activeInputMode === 'search' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Timeframe Radio Buttons */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center space-x-1.5">
                <Calendar className="w-4 h-4 text-blue-400" />
                <span>탐색 기간 (한국 시각 Asia/Seoul 기준)</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'today' as TimeframeOption, label: '오늘', desc: '00:00 ~ 현재' },
                  { id: 'last_7_days' as TimeframeOption, label: '최근 7일', desc: '168시간 전' },
                  { id: 'last_30_days' as TimeframeOption, label: '최근 30일', desc: '720시간 전' },
                ].map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setTimeframe(item.id)}
                    className={`py-2 px-3 rounded-xl border text-center transition ${
                      timeframe === item.id
                        ? 'border-blue-500 bg-blue-600/20 text-blue-300 font-bold shadow-sm'
                        : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <div className="text-xs font-semibold">{item.label}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Extra Keyword */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>추가 관심 키워드 (선택)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="예: HBM4, 전고체, 신공장, 수주, 생성형 AI"
                  value={extraKeyword}
                  onChange={(e) => setExtraKeyword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearch();
                    }
                  }}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                기업명({activeTarget.companyName}) 및 직무({activeTarget.jobRole})와 함께 검색 질의에 반영됩니다.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between pt-2 border-t border-slate-800/80 gap-3">
            <span className="text-xs text-slate-400">
              * 검색 결과 전체가 아닌, <strong>선택하신 기사만</strong> Gemini로 심층 분석합니다.
            </span>
            <button
              onClick={() => handleSearch()}
              disabled={isSearching}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-blue-600/20 transition cursor-pointer"
            >
              {isSearching ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>실시간 뉴스 찾는 중...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>뉴스 찾기</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* MODE 2: Direct URL */}
      {activeInputMode === 'url' && (
        <form onSubmit={handleAnalyzeFromUrl} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white mb-1">기사 웹 URL 직접 입력</h3>
            <p className="text-xs text-slate-400">
              뉴스 기사 웹페이지 주소를 입력하면 서버에서 안전하게 본문을 수집(SSRF 보호 적용)하여 분석을 수행합니다.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              기사 원문 URL <span className="text-rose-400">*</span>
            </label>
            <input
              type="url"
              required
              placeholder="https://..."
              value={directUrl}
              onChange={(e) => setDirectUrl(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              기사 제목 <span className="text-slate-500">(선택, 미입력 시 웹페이지에서 자동 추출)</span>
            </label>
            <input
              type="text"
              placeholder="예: [단독] 삼성전자 신규 파운드리 팹 착공"
              value={directUrlTitle}
              onChange={(e) => setDirectUrlTitle(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-md transition"
            >
              <Sparkles className="w-4 h-4" />
              <span>본문 수집 및 분석 시작</span>
            </button>
          </div>
        </form>
      )}

      {/* MODE 3: Direct Text */}
      {activeInputMode === 'text' && (
        <form onSubmit={handleAnalyzeFromText} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white mb-1">기사 본문 직접 붙여넣기</h3>
            <p className="text-xs text-slate-400">
              유료벽이나 복사 방지가 적용된 기사는 텍스트를 직접 복사하여 붙여넣으면 온전하게 분석할 수 있습니다.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">기사 제목</label>
              <input
                type="text"
                placeholder="기사 제목을 입력하세요"
                value={directTextTitle}
                onChange={(e) => setDirectTextTitle(e.target.value)}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                출처 URL <span className="text-slate-500">(선택, 미제공 시 '원문 링크 미제공'으로 표시)</span>
              </label>
              <input
                type="url"
                placeholder="https://..."
                value={directTextUrl}
                onChange={(e) => setDirectTextUrl(e.target.value)}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              기사 본문 텍스트 <span className="text-rose-400">*</span>
            </label>
            <textarea
              required
              rows={7}
              placeholder="기사 본문을 여기에 붙여넣어 주세요 (최소 50자 이상)..."
              value={directTextContent}
              onChange={(e) => setDirectTextContent(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-md transition"
            >
              <Sparkles className="w-4 h-4" />
              <span>본문 분석하기</span>
            </button>
          </div>
        </form>
      )}

      {/* 429 RESOURCE_EXHAUSTED Quota Diagnostic Card */}
      {quotaError && (
        <div className="p-5 rounded-2xl bg-amber-950/30 border border-amber-500/40 shadow-lg space-y-4 animate-fadeIn">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold text-amber-200">
                    요청 한도 초과 (429 RESOURCE_EXHAUSTED)
                  </h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {quotaError.limitType === 'search_grounding_limit'
                      ? 'Google Search 도구 한도'
                      : quotaError.limitType === 'rate_limit_rpm'
                      ? '분당 요청 한도 (RPM)'
                      : quotaError.limitType === 'daily_limit_rpd'
                      ? '일일 요청 한도 (RPD)'
                      : '원인 미확정 (한도 종류 불명)'}
                  </span>
                </div>
                <p className="text-xs text-amber-300/90 mt-1 leading-relaxed">
                  {quotaError.friendlyMessage}
                </p>
              </div>
            </div>

            {/* Manual Retry Button with optional countdown */}
            <button
              onClick={() => handleSearch()}
              disabled={isSearching || (countdownSeconds !== null && countdownSeconds > 0)}
              className="shrink-0 flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-md transition cursor-pointer"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isSearching ? 'animate-spin' : ''}`} />
              <span>
                {countdownSeconds !== null && countdownSeconds > 0
                  ? `${countdownSeconds}초 후 재시도 가능`
                  : '수동 재시도'}
              </span>
            </button>
          </div>

          {/* Technical Diagnostics Box (Without leaking any secrets or keys) */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 space-y-2">
            <div className="font-semibold text-slate-200 flex items-center space-x-1.5">
              <Info className="w-4 h-4 text-blue-400" />
              <span>진단 정보 (API 키 및 비밀값 제외)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-800">
              <div>
                호출 모델: <strong className="text-slate-200">{quotaError.diagnostics.modelUsed}</strong>
              </div>
              <div>
                호출 메서드: <code className="text-slate-300">{quotaError.diagnostics.apiMethod}</code>
              </div>
              <div>
                Search 도구 사용 여부:{' '}
                <strong className={quotaError.diagnostics.usedSearchTool ? 'text-amber-300' : 'text-slate-200'}>
                  {quotaError.diagnostics.usedSearchTool ? '사용함 (Google Search Grounding)' : '사용 안 함'}
                </strong>
              </div>
            </div>
            <div className="text-[11px] text-slate-400">
              판정 상태:{' '}
              {quotaError.limitType === 'unknown_quota_type' ? (
                <span className="text-amber-300">
                  원인 미확정 (수신된 오류 정보만으로는 Gemini 모델의 분당/일일 한도인지, Google Search 도구의 쿼리 한도인지 확정할 수 없음)
                </span>
              ) : (
                <span className="text-slate-200">{quotaError.limitType}</span>
              )}
            </div>
          </div>

          {/* Alternative Path & Offline Feature Assurance */}
          <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-900/40 text-xs space-y-2">
            <div className="font-semibold text-blue-300 flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>대체 경로 및 이용 가능 기능 안내</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
              <li>
                <strong>직접 입력 기사 분석:</strong> Search 도구 한도만 소진된 경우라면 [URL 입력] 또는 [본문 직접 붙여넣기]를 통한 분석이 가능할 수 있습니다. (단, 모델 자체 한도가 소진된 경우라면 본문 분석도 429 오류가 발생할 수 있습니다.)
              </li>
              <li>
                <strong>API 무관 오프라인 기능:</strong> 이미 저장된 북마크 조회, 키워드 검색, 태그 필터링, 개인 메모 작성 및 JSON 백업/복원 기능은 외부 API 호출 없이 브라우저 로컬(IndexedDB)에서 100% 정상 작동합니다.
              </li>
            </ul>

            <div className="pt-2 border-t border-blue-900/40 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleLoadSampleArticles}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition flex items-center space-x-1.5 cursor-pointer shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>체험용 샘플 기사 목록 불러오기</span>
              </button>
              <button
                type="button"
                onClick={handleFillSampleDirectText}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs border border-slate-700 transition flex items-center space-x-1.5 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>[기사 직접 입력]에 예시 채우기</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* General Search Error (Non-Quota) */}
      {searchError && !quotaError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start space-x-2.5">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">뉴스 검색 알림</div>
            <div className="mt-0.5 text-xs text-rose-200">{searchError}</div>
          </div>
        </div>
      )}

      {/* Search Results Display */}
      {searchResponse && (
        <div className="space-y-4">
          {/* Metadata bar */}
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-3">
              <span className="flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                <span>검색 실행: {searchResponse.searchTimeKST}</span>
              </span>
              <span className="text-slate-600">|</span>
              <span>
                탐색 범위:{' '}
                <strong className="text-slate-200">
                  {searchResponse.timeframe === 'today'
                    ? '오늘(당일 00:00~현재)'
                    : searchResponse.timeframe === 'last_7_days'
                    ? '최근 7일'
                    : '최근 30일'}
                </strong>
              </span>
              <span className="text-slate-600">|</span>
              <span>
                검색 질의: <code className="text-slate-300">"{searchResponse.queryUsed}"</code>
              </span>
            </div>

            <div className="flex items-center space-x-2">
              {searchResponse.excludedCountMissingDate > 0 && (
                <span className="text-amber-400/90 text-[11px]">
                  발행일 미상 제외: {searchResponse.excludedCountMissingDate}건
                </span>
              )}
              {searchResponse.excludedCountOutOfRange > 0 && (
                <span className="text-slate-400 text-[11px]">
                  기간 외 제외: {searchResponse.excludedCountOutOfRange}건
                </span>
              )}
              {searchResponse.timeframe !== 'last_30_days' && (
                <button
                  onClick={() => handleSearch('last_30_days')}
                  disabled={isSearching}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-blue-300 hover:text-white border border-slate-700 font-medium transition cursor-pointer"
                >
                  최근 30일로 넓히기
                </button>
              )}
            </div>
          </div>

          {searchResponse.notes && (
            <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-900/30 text-blue-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{searchResponse.notes}</span>
            </div>
          )}

          {/* Article Cards */}
          {searchResponse.articles.length === 0 ? (
            <div className="p-12 rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 text-center space-y-3">
              <Layers className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-300">선택한 기간 내 확인된 기사가 없습니다.</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                필터 기간을 '최근 30일'로 넓히거나, 추가 키워드를 변경해 보세요. 또는 관심 있는 기사 URL이나 본문을 직접
                입력하여 분석할 수 있습니다.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleLoadSampleArticles}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span>체험용 샘플 기사 목록 불러오기</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>추천 기사 목록 ({searchResponse.articles.length}건)</span>
                <span className="text-slate-500">※ 인터넷 상의 모든 기사를 망라한 것은 아닙니다.</span>
              </div>

              {searchResponse.articles.map((article) => {
                const isBookmarked = bookmarkedUrls.has(article.sourceUrl);
                const isExpanded = expandedRelated.has(article.id);
                const hasRelated = article.relatedArticles && article.relatedArticles.length > 0;

                return (
                  <div
                    key={article.id}
                    className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition space-y-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              article.relationType === 'company_direct'
                                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}
                          >
                            {article.relationType === 'company_direct' ? '기업 직접 관련' : '산업·직무 관련'}
                          </span>

                          <span className="text-xs text-slate-400 font-medium">{article.publisher}</span>

                          <span className="text-xs text-slate-500">
                            발행일: {formatToKST(article.publishedAt, article.publishedDatePrecision)}
                          </span>

                          {isBookmarked && (
                            <span className="flex items-center space-x-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                              <BookmarkCheck className="w-3 h-3" />
                              <span>저장됨</span>
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-bold text-white hover:text-blue-400 transition">
                          <a
                            href={article.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-1"
                          >
                            <span>{article.title}</span>
                            <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                          </a>
                        </h3>

                        <p className="text-xs text-slate-400 flex items-center space-x-1.5">
                          <span className="text-slate-500">선정 이유:</span>
                          <span>{article.selectionReason}</span>
                        </p>
                      </div>

                      <button
                        onClick={() => handleAnalyzeFromSearch(article)}
                        className="shrink-0 flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>분석하기</span>
                      </button>
                    </div>

                    {/* Related Coverage Accordion */}
                    {hasRelated && (
                      <div className="pt-2 border-t border-slate-800/80">
                        <button
                          onClick={() => toggleRelated(article.id)}
                          className="flex items-center space-x-1 text-xs text-blue-400 hover:text-blue-300 font-medium"
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          <span>동일 사건 관련 보도 및 후속 보도 ({article.relatedArticles?.length}건)</span>
                        </button>

                        {isExpanded && (
                          <div className="mt-2.5 space-y-2 pl-3 border-l-2 border-slate-800">
                            {article.relatedArticles?.map((rel, idx) => (
                              <div key={idx} className="flex items-center justify-between text-xs text-slate-300">
                                <div className="flex items-center space-x-2">
                                  {rel.isFollowUp && (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                      후속 보도
                                    </span>
                                  )}
                                  <span className="text-slate-400">{rel.publisher}</span>
                                  <a
                                    href={rel.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-blue-400 underline decoration-slate-600"
                                  >
                                    {rel.title}
                                  </a>
                                </div>
                                <span className="text-[11px] text-slate-500">
                                  {formatToKST(rel.publishedAt, 'date')}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
