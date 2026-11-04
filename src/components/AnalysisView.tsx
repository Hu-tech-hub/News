/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ExternalLink,
  BookmarkCheck,
  Check,
  HelpCircle,
  Briefcase,
  Building,
  Tag,
  AlertTriangle,
  FileText,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Quote,
  ShieldCheck,
  ArrowRight,
  Info,
} from 'lucide-react';
import { AnalysisResult, ContentStatus, SourceItem, TargetProfile } from '../types';
import { formatToKST } from '../utils/date';

interface AnalysisViewProps {
  articleTitle: string;
  sourceUrl: string | null;
  publisher?: string | null;
  publishedAt?: string | null;
  contentStatus: ContentStatus;
  articleText: string;
  analysis: AnalysisResult | null;
  sources: SourceItem[];
  activeTarget: TargetProfile | null;
  isAnalyzing: boolean;
  onSaveBookmark: () => Promise<void>;
  isBookmarked: boolean;
  onReAnalyzeWithTarget: () => void;
  errorMessage?: string;
  onRetryWithCustomText: (text: string) => void;
  onLoadSampleAnalysis?: () => void;
}

export const AnalysisView: React.FC<AnalysisViewProps> = ({
  articleTitle,
  sourceUrl,
  publisher,
  publishedAt,
  contentStatus,
  articleText,
  analysis,
  sources,
  activeTarget,
  isAnalyzing,
  onSaveBookmark,
  isBookmarked,
  onReAnalyzeWithTarget,
  errorMessage,
  onRetryWithCustomText,
  onLoadSampleAnalysis,
}) => {
  const [showFullText, setShowFullText] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Dynamic step progression and timer while analyzing
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  React.useEffect(() => {
    if (!isAnalyzing) {
      setElapsedSeconds(0);
      return;
    }

    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isAnalyzing]);

  // Check if current target differs from analysis snapshot
  const isTargetMismatched =
    analysis &&
    activeTarget &&
    (analysis.targetSnapshot.companyName !== activeTarget.companyName ||
      analysis.targetSnapshot.jobRole !== activeTarget.jobRole);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveBookmark();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  if (isAnalyzing) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-6 animate-fadeIn">
        <div className="relative w-20 h-20 mx-auto">
          <div className="absolute inset-0 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
          <div className="absolute inset-3 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-400">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
            <span>진행 중 ({elapsedSeconds}초 경과)</span>
          </div>
          <h2 className="text-xl font-bold text-white">기사 분석 요청 처리 중</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            기사 본문을 확인한 뒤 {activeTarget?.companyName || '목표 기업'} 및{' '}
            {activeTarget?.jobRole || '직무'}에 맞춰 분석하고 있습니다. Gemini 응답까지 잠시 걸릴 수 있습니다.
          </p>
        </div>

        <div className="max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-slate-400">
          현재 단계별 진행 상황은 화면에 실시간 표시되지 않습니다. 요청이 완료되거나 시간 제한에 도달하면 결과를 표시합니다.
        </div>

        {/* Server delay or API quota shortcut notice */}
        {elapsedSeconds >= 5 && onLoadSampleAnalysis && (
          <div className="max-w-lg mx-auto p-4 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-xs text-amber-200 text-left space-y-2.5 animate-fadeIn">
            <div className="flex items-center space-x-2 font-bold text-amber-300">
              <Info className="w-4 h-4" />
              <span>구글 모델 응답 지연 또는 일시적 트래픽 집중 안내</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              구글 Gemini 서버 트래픽이 몰리거나 API 한도 상황일 수 있습니다. 기다리지 않고 즉시 완성된 분석 화면과 북마크 기능을 확인하시려면 아래 버튼을 눌러보세요.
            </p>
            <button
              type="button"
              onClick={onLoadSampleAnalysis}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition flex items-center justify-center space-x-2 cursor-pointer shadow-md"
            >
              <Sparkles className="w-4 h-4" />
              <span>체험용 샘플 분석 결과로 즉시 확인하기</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // Error / Needs manual text input state
  if (contentStatus === 'fetch_failed_needs_text' || (!analysis && errorMessage)) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-6 animate-fadeIn">
        <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-5">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h2 className="text-base font-bold text-white">기사 분석 알림</h2>
              <p className="text-xs text-amber-300/90 leading-relaxed">
                {errorMessage ||
                  '웹사이트 보안 정책(봇 차단, 유료벽 등) 또는 모델 응답 지연으로 인해 분석을 완료하지 못했습니다.'}
              </p>
            </div>
          </div>

          {/* Quick Experience Shortcut */}
          {onLoadSampleAnalysis && (
            <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-500/30 space-y-2">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-blue-300">
                <Sparkles className="w-4 h-4" />
                <span>API 오류와 상관없이 전체 기능 즉시 체험하기</span>
              </div>
              <p className="text-[11px] text-slate-300">
                실제 형식의 반도체·제조 기사 요약, 직무 시사점, 모의 면접 질문, 출처 바인딩 및 IndexedDB 북마크 저장 기능을 바로 테스트해 보실 수 있습니다.
              </p>
              <button
                type="button"
                onClick={onLoadSampleAnalysis}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>체험용 샘플 분석 결과로 전체 화면 확인하기</span>
              </button>
            </div>
          )}

          <div className="border-t border-amber-500/20 pt-4 space-y-3">
            <p className="text-xs text-slate-300">
              정확한 분석을 위해 기사 페이지에서 텍스트를 직접 복사하여 아래에 붙여넣어 주세요:
            </p>
            <textarea
              rows={6}
              placeholder="복사한 기사 본문을 여기에 붙여넣으세요 (최소 50자 이상)..."
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <div className="flex justify-end">
              <button
                onClick={() => onRetryWithCustomText(pasteText)}
                disabled={pasteText.trim().length < 50}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs shadow-md transition cursor-pointer"
              >
                붙여넣은 본문으로 분석 재시도
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500">
          <FileText className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-white">분석된 기사가 없습니다</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          '뉴스 찾기' 탭에서 기사를 선택하거나, 기사 URL 또는 본문을 입력하여 분석을 시작하세요.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-fadeIn">
      {/* Target Mismatch Warning */}
      {isTargetMismatched && (
        <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/40 text-indigo-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Info className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>
              이 분석은 과거 <strong>{analysis.targetSnapshot.companyName} ({analysis.targetSnapshot.jobRole})</strong>{' '}
              기준으로 생성되었습니다. 현재 선택된 대상(
              <strong>{activeTarget.companyName}</strong>)으로 다시 분석하시겠습니까?
            </span>
          </div>
          <button
            onClick={onReAnalyzeWithTarget}
            className="self-start sm:self-center shrink-0 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition"
          >
            현재 대상으로 재분석
          </button>
        </div>
      )}

      {/* Article Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${
                contentStatus === 'full_text_fetched'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  : 'bg-blue-500/10 text-blue-300 border-blue-500/30'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 inline mr-1" />
              {contentStatus === 'full_text_fetched' ? '전체 본문 확보 완료' : '사용자 제공 직접 본문'}
            </span>

            {publisher && <span className="text-xs text-slate-300 font-medium">{publisher}</span>}

            {publishedAt && (
              <span className="text-xs text-slate-400">발행: {formatToKST(publishedAt, 'date')}</span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-2">
            {sourceUrl ? (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-xs text-slate-300 hover:text-white transition"
              >
                <span>원문 기사 열기</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              </a>
            ) : (
              <span className="text-xs text-slate-500 px-2 py-1 bg-slate-800 rounded-lg">원문 링크 미제공</span>
            )}

            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition shadow-sm ${
                isBookmarked || saveSuccess
                  ? 'bg-emerald-600/90 text-white hover:bg-emerald-500'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20'
              }`}
            >
              {isBookmarked || saveSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{saveSuccess ? '저장 완료!' : '북마크 저장됨'}</span>
                </>
              ) : (
                <>
                  <BookmarkCheck className="w-3.5 h-3.5" />
                  <span>북마크 보관</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">{articleTitle}</h1>

        {/* Target Snapshot Banner */}
        <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3 text-xs">
            <span className="font-semibold text-blue-400">분석 기준 대상:</span>
            <span className="font-bold text-white">
              {analysis.targetSnapshot.companyName} / {analysis.targetSnapshot.jobRole}
            </span>
            {analysis.targetSnapshot.industryTags.length > 0 && (
              <span className="text-slate-400 hidden sm:inline">
                ({analysis.targetSnapshot.industryTags.join(', ')})
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-400">
            분석 시각: {formatToKST(analysis.analyzedAt, 'datetime')} ({analysis.modelId})
          </span>
        </div>
      </div>

      {/* SECTION A: 기사 핵심 요약 (사실 수치 보존) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-base font-bold text-white flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span>기사에서 확인한 사실 (핵심 요약)</span>
          </h2>
          <span className="text-xs text-slate-400">수치·일정 보존 및 원문 대조</span>
        </div>

        <div className="space-y-3">
          {analysis.summaryItems.map((item, idx) => (
            <div key={idx} className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-slate-100 font-medium leading-relaxed">{item.factText}</p>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 shrink-0">
                  {item.sourceId}
                </span>
              </div>

              {item.quoteSnippet && (
                <div className="flex items-start space-x-2 text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                  <Quote className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                  <span className="italic">"{item.quoteSnippet}"</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* SECTION B: 자동 분류 태그 */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
        <h2 className="text-base font-bold text-white flex items-center space-x-2 border-b border-slate-800 pb-3">
          <Tag className="w-4 h-4 text-emerald-400" />
          <span>기사 자동 분류 태그</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Industry Tags */}
          <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 block mb-2">관련 산업</span>
            <div className="flex flex-wrap gap-1.5">
              {analysis.industryTags.map((tag) => (
                <span key={tag} className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  #{tag}
                </span>
              ))}
            </div>
          </div>

          {/* Company Tags */}
          <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 block mb-2">언급 기업</span>
            <div className="flex flex-wrap gap-1.5">
              {analysis.companyTags.map((tag) => (
                <span key={tag} className="text-xs px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Issue Tags */}
          <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 block mb-2">핵심 이슈 키워드</span>
            <div className="flex flex-wrap gap-1.5">
              {analysis.issueTags.map((tag) => (
                <span key={tag} className="text-xs px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION C: 기업·직무 맞춤 시사점 (AI 추론 명확 분리) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-base font-bold text-white flex items-center space-x-2">
            <Building className="w-4 h-4 text-blue-400" />
            <span>
              {analysis.targetSnapshot.companyName} · {analysis.targetSnapshot.jobRole} 맞춤 시사점
            </span>
          </h2>
          <span className="text-xs text-slate-400">AI 추론과 기사 사실 분리</span>
        </div>

        <div className="space-y-4">
          {analysis.implications.map((imp, idx) => (
            <div key={idx} className="p-5 rounded-2xl bg-slate-800/40 border border-slate-800 space-y-3.5">
              {/* 1. 기사 사실 */}
              <div>
                <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider block mb-1">
                  1. 근거가 되는 기사 사실
                </span>
                <p className="text-sm text-slate-200 bg-slate-900/50 p-3 rounded-xl border border-slate-800/80">
                  {imp.factualBasis}
                </p>
              </div>

              {/* 2. 기업 영향 */}
              <div>
                <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">
                  2. {analysis.targetSnapshot.companyName}에 대한 영향 및 쟁점
                </span>
                <p className="text-sm text-slate-300 leading-relaxed pl-1">{imp.companyImpact}</p>
              </div>

              {/* 3. 직무 과제 */}
              <div>
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">
                  3. {analysis.targetSnapshot.jobRole} 지원 직무 관련 과제 및 기회
                </span>
                <p className="text-sm text-slate-300 leading-relaxed pl-1">{imp.jobRoleChallenge}</p>
              </div>

              {/* 4. 해석 한계 */}
              <div className="pt-2 border-t border-slate-800/80 flex items-start space-x-2 text-xs text-slate-400">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-slate-300">해석의 한계:</strong> {imp.caveatsAndLimits}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION D: AI 생성 예상 면접 질문 */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-base font-bold text-white flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>AI 생성 예상 면접 질문 (연습용)</span>
          </h2>
          <span className="text-xs text-purple-300 font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30">
            모의 연습용 (기출 아님)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {analysis.interviewQuestions.map((q, idx) => (
            <div key={idx} className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800 space-y-2.5 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-purple-400 uppercase">Q{idx + 1}. 연습 질문</span>
                  <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md font-mono">
                    {q.focusArea}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white leading-snug">{q.question}</h3>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 space-y-1">
                <span className="font-semibold text-slate-300 block">면접관의 질문 의도:</span>
                <p>{q.intent}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION E: 확인 필요 사항 */}
      {analysis.uncertainties.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-3 shadow-sm">
          <h2 className="text-sm font-bold text-amber-300 flex items-center space-x-2">
            <HelpCircle className="w-4 h-4 text-amber-400" />
            <span>확인 필요 사항 및 근거 부족 쟁점</span>
          </h2>
          <ul className="list-disc list-inside space-y-1 text-xs text-slate-400 pl-1">
            {analysis.uncertainties.map((u, idx) => (
              <li key={idx}>{u}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Full Article Text Drawer Accordion */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-3">
        <button
          onClick={() => setShowFullText(!showFullText)}
          className="w-full flex items-center justify-between text-xs font-semibold text-slate-300 hover:text-white"
        >
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-blue-400" />
            <span>확보된 기사 본문 텍스트 전문 검토 ({articleText.length}자)</span>
          </div>
          {showFullText ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showFullText && (
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 font-mono whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed">
            {articleText}
          </div>
        )}
      </div>
    </div>
  );
};
