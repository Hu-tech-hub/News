/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ApiQuotaError, SearchResponse, TimeframeOption } from '../types';
import { WorkflowOutput } from '../../server/adk-workflow';

export class ApiError extends Error {
  quotaError?: ApiQuotaError;
  status?: number;
  constructor(message: string, quotaError?: ApiQuotaError, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.quotaError = quotaError;
    this.status = status;
  }
}

export interface SystemStatusResponse {
  geminiConfigured: boolean;
  model: string;
  searchModel?: string;
  adkPackage: string;
  adkVersion: string;
  promptVersion: string;
  searchGroundingSupported: boolean;
  statusMessage: string;
  apiMetrics?: {
    totalSearchApiCalls: number;
    totalAnalysisApiCalls: number;
    inFlightSearchesCount: number;
  };
}

export async function getSystemStatus(): Promise<SystemStatusResponse> {
  const res = await fetch('/api/system-status');
  if (!res.ok) {
    throw new Error('시스템 상태 조회에 실패했습니다.');
  }
  return res.json();
}

export async function searchNews(params: {
  companyName: string;
  jobRole: string;
  industryTags: string[];
  extraKeyword?: string;
  timeframe: TimeframeOption;
}, signal?: AbortSignal): Promise<SearchResponse> {
  const res = await fetch('/api/search-news', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new ApiError(
      errorData.error || errorData.quotaError?.friendlyMessage || '뉴스 검색 요청에 실패했습니다.',
      errorData.quotaError,
      res.status
    );
  }

  return res.json();
}

export async function fetchArticleFromUrl(url: string): Promise<{
  success: boolean;
  title?: string;
  text?: string;
  error?: string;
}> {
  const res = await fetch('/api/fetch-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  return res.json();
}

export async function analyzeArticle(params: {
  articleTitle: string;
  articleText?: string;
  sourceUrl?: string | null;
  targetCompany: string;
  targetRole: string;
  industryTags: string[];
  inputType: 'search' | 'url' | 'text';
}): Promise<WorkflowOutput> {
  const res = await fetch('/api/analyze-article', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.errorMessage || errorData.error || '기사 분석 요청에 실패했습니다.');
  }

  return res.json();
}
