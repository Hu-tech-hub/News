/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Target company and job role combinations
export type AnalysisStage = 'receiving' | 'fetching' | 'analyzing' | 'validating';
export interface AnalysisProgress {
  stage: AnalysisStage;
  elapsedMs: number;
}

export interface TargetProfile {
  id: string;
  companyName: string;
  jobRole: string;
  industryTags: string[];
  createdAt: number;
  updatedAt: number;
}

export type PublishedDatePrecision = 'datetime' | 'date' | 'unknown';

export type InputType = 'search' | 'url' | 'text';

export type ContentStatus = 
  | 'full_text_fetched' 
  | 'user_provided_text' 
  | 'fetch_failed_needs_text' 
  | 'partial_text';

export type AnalysisStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface SourceItem {
  sourceId: string;
  title: string;
  url: string | null;
  publisher: string | null;
  publishedAt: string | null;
  retrievedAt: string;
  sourceType: 'retrieved_article' | 'user_provided' | 'external_reference';
  verificationStatus: 'verified_url' | 'user_unverified' | 'fetch_error';
}

export interface SummaryFactItem {
  factText: string;
  sourceId: string;
  quoteSnippet?: string;
  label?: string;
  layout?: 'card' | 'metric' | 'timeline' | 'table';
  value?: string;
  status?: '확인된 사실' | '발표된 계획' | '논의' | '전망' | '조사 중';
}

export interface ArticleOverview {
  type: '사건·사고' | '실적·시장 동향' | '기업 전략·기술 발표' | '정책·제도' | '협력·계약·인수' | '연구·전망·의견';
  takeaway: string;
  context?: string;
}

export interface ImplicationItem {
  factualBasis: string;
  companyImpact: string;
  jobRoleChallenge: string;
  caveatsAndLimits: string;
  sourceId: string;
}

export interface InterviewQuestionItem {
  question: string;
  intent: string;
  sourceId: string;
  focusArea: 'tech' | 'process' | 'industry_trend' | 'company_strategy';
  answerGuide?: {
    opening: string;
    keyPoints: string[];
    experienceTip: string;
  };
}

export interface AnalysisResult {
  articleOverview?: ArticleOverview;
  industryTags: string[];
  companyTags: string[];
  issueTags: string[];
  summaryItems: SummaryFactItem[];
  implications: ImplicationItem[];
  interviewQuestions: InterviewQuestionItem[];
  uncertainties: string[];
  targetSnapshot: {
    companyName: string;
    jobRole: string;
    industryTags: string[];
  };
  modelId: string;
  promptVersion: string;
  analyzedAt: string;
  orchestrator: 'google-adk-workflow' | 'fallback-direct';
}

export interface Bookmark {
  articleOverview?: ArticleOverview;
  id: string;
  title: string;
  sourceUrl: string | null;
  canonicalUrl: string | null;
  publisher: string | null;
  publishedAt: string | null;
  publishedDatePrecision: PublishedDatePrecision;
  articleUpdatedAt: string | null;
  inputType: InputType;
  contentStatus: ContentStatus;
  articleText: string;
  industryTags: string[];
  companyTags: string[];
  issueTags: string[];
  summaryItems: SummaryFactItem[];
  targetSnapshot: {
    companyName: string;
    jobRole: string;
    industryTags: string[];
  };
  implications: ImplicationItem[];
  interviewQuestions: InterviewQuestionItem[];
  sources: SourceItem[];
  uncertainties: string[];
  analysisStatus: AnalysisStatus;
  analyzedAt: string;
  modelId: string;
  promptVersion: string;
  createdAt: number;
  updatedAt: number;
  userNotes?: string;
}

export type TimeframeOption = 'today' | 'last_7_days' | 'last_30_days';

export interface SearchArticleItem {
  id: string;
  title: string;
  publisher: string;
  sourceUrl: string;
  publishedAt: string | null;
  articleUpdatedAt?: string | null;
  publishedDatePrecision: PublishedDatePrecision;
  relationType: 'company_direct' | 'industry_role';
  selectionReason: string;
  isBookmarked?: boolean;
  bookmarkedId?: string;
  relatedArticles?: Array<{
    title: string;
    publisher: string;
    sourceUrl: string;
    publishedAt: string | null;
    isFollowUp?: boolean;
    note?: string;
  }>;
}

export type QuotaLimitType =
  | 'rate_limit_rpm'
  | 'daily_limit_rpd'
  | 'search_grounding_limit'
  | 'unknown_quota_type';

export interface ApiQuotaError {
  isQuotaExhausted: boolean;
  status: number;
  errorCode: string;
  limitType: QuotaLimitType;
  retryAfterSeconds?: number;
  friendlyMessage: string;
  diagnostics: {
    modelUsed: string;
    apiMethod: string;
    usedSearchTool: boolean;
    quotaDetails?: string;
  };
}

export interface SearchResponse {
  articles: SearchArticleItem[];
  searchTimeKST: string;
  timeframe: TimeframeOption;
  queryUsed: string;
  targetCompany: string;
  targetRole: string;
  excludedCountMissingDate: number;
  excludedCountOutOfRange: number;
  totalFoundRaw: number;
  isGroundingLive: boolean;
  notes?: string;
  quotaError?: ApiQuotaError;
}

export interface BackupExportData {
  schemaVersion: 1;
  exportedAt: string;
  appVersion: string;
  targets: TargetProfile[];
  bookmarks: Bookmark[];
}

export interface ImportPreviewResult {
  valid: boolean;
  errorMessage?: string;
  schemaVersion?: number;
  exportedAt?: string;
  totalTargetsInFile: number;
  newTargetsCount: number;
  existingTargetsCount: number;
  totalBookmarksInFile: number;
  newBookmarksCount: number;
  existingBookmarksCount: number;
  parsedData?: BackupExportData;
}
