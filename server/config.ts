/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const SERVER_CONFIG = {
  // Lowest-cost stable Gemini model for text analysis.
  GEMINI_MODEL: 'gemini-3.1-flash-lite',
  PROMPT_VERSION: 'v1.6.0-article-layouts',
  
  // Timeouts (milliseconds)
  SEARCH_TIMEOUT_MS: 18000,
  FETCH_URL_TIMEOUT_MS: 4500,
  ANALYSIS_TIMEOUT_MS: 40000,
  
  // Limits
  MAX_ARTICLE_CHARS: 15000,
  MAX_ARTICLE_BYTES: 1024 * 1024, // 1MB
  MAX_REDIRECTS: 3,
  MAX_RETRY_ATTEMPTS: 2,

  // Orchestrator
  ADK_PACKAGE: '@google/adk',
  ADK_VERSION: '2.4.0',
};
