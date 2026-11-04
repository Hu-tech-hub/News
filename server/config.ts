/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const SERVER_CONFIG = {
  // Model selection: strictly gemini-3.8-flash for high quality reasoning & grounding
  GEMINI_MODEL: 'gemini-3.8-flash',
  PROMPT_VERSION: 'v1.2.0-career-notes',
  
  // Timeouts (milliseconds)
  SEARCH_TIMEOUT_MS: 18000,
  FETCH_URL_TIMEOUT_MS: 9000,
  ANALYSIS_TIMEOUT_MS: 35000,
  
  // Limits
  MAX_ARTICLE_CHARS: 15000,
  MAX_ARTICLE_BYTES: 1024 * 1024, // 1MB
  MAX_REDIRECTS: 3,
  MAX_RETRY_ATTEMPTS: 2,

  // Orchestrator
  ADK_PACKAGE: '@google/adk',
  ADK_VERSION: '2.4.0',
};
