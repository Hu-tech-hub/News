/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ApiQuotaError, SearchResponse, TimeframeOption, AnalysisProgress } from '../types';
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
  googleSheetsClientId?: string;
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
}, onProgress?: (progress: AnalysisProgress) => void, signal?: AbortSignal): Promise<WorkflowOutput> {
  const res = await fetch('/api/analyze-article', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
    body: JSON.stringify(params),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(65_000)]) : AbortSignal.timeout(65_000),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.errorMessage || errorData.error || '기사 분석 요청에 실패했습니다.');
  }

  if (!res.headers.get('content-type')?.includes('application/x-ndjson')) return res.json();
  if (!res.body) throw new Error('분석 진행 응답을 읽을 수 없습니다.');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      if (done && buffer.trim()) lines.push(buffer);
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (event.type === 'progress') onProgress?.({ stage: event.stage, elapsedMs: event.elapsedMs });
        if (event.type === 'result') return event.result;
        if (event.type === 'error') throw new Error(event.message);
      }
      if (done) throw new Error('분석 연결이 결과 수신 전에 종료되었습니다. 다시 시도해 주세요.');
    }
  } finally { reader.releaseLock(); }
}
