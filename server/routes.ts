/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { isGeminiConfigured, getApiCallMetrics } from './gemini.js';
import { searchRealNews } from './news.js';
import { fetchSafeArticle } from './ssrf.js';
import { runJobNewsADKWorkflow } from './adk-workflow.js';
import { SERVER_CONFIG } from './config.js';

export const apiRouter = Router();

// System Status endpoint
apiRouter.get('/system-status', (_req: Request, res: Response) => {
  const geminiReady = isGeminiConfigured();
  res.json({
    geminiConfigured: geminiReady,
    model: SERVER_CONFIG.GEMINI_MODEL,
    searchModel: 'Google 뉴스 RSS',
    adkPackage: SERVER_CONFIG.ADK_PACKAGE,
    adkVersion: SERVER_CONFIG.ADK_VERSION,
    promptVersion: SERVER_CONFIG.PROMPT_VERSION,
    searchGroundingSupported: false,
    apiMetrics: getApiCallMetrics(),
    statusMessage: geminiReady
      ? `${SERVER_CONFIG.GEMINI_MODEL} 및 Google ADK 워크플로가 정상 가동 중입니다.`
      : '뉴스 RSS 검색은 사용 가능합니다. 기사 분석에는 GEMINI_API_KEY 환경변수가 필요합니다.',
  });
});

// Search News endpoint
apiRouter.post('/search-news', async (req: Request, res: Response) => {
  try {
    const { companyName, jobRole, industryTags = [], extraKeyword = '', timeframe = 'last_7_days' } = req.body;

    if (!companyName || !jobRole) {
      return res.status(400).json({
        error: '기업명(companyName)과 직무명(jobRole)은 필수 검색 조건입니다.',
      });
    }

    const searchResult = await searchRealNews({
      companyName,
      jobRole,
      industryTags,
      extraKeyword,
      timeframe,
    });

    return res.json(searchResult);
  } catch (err: unknown) {
    console.error('Search news route error:', err);
    return res.status(500).json({
      error: `뉴스 검색 처리 중 서버 오류가 발생했습니다: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
});

// Safe Fetch URL endpoint
apiRouter.post('/fetch-url', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: '유효한 URL을 전달해주세요.' });
    }

    const result = await fetchSafeArticle(url);
    return res.json(result);
  } catch (err: unknown) {
    return res.status(500).json({
      success: false,
      error: `URL 수집 오류: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
});

// Run ADK Career News Analysis endpoint
apiRouter.post('/analyze-article', async (req: Request, res: Response) => {
  const streaming = req.headers.accept?.includes('application/x-ndjson');
  const startedAt = Date.now();
  const send = (event: unknown) => {
    if (!res.destroyed && !res.writableEnded) res.write(`${JSON.stringify(event)}\n`);
  };
  try {
    const {
      articleTitle,
      articleText,
      sourceUrl,
      targetCompany,
      targetRole,
      industryTags = [],
      inputType = 'text',
    } = req.body;

    if (!targetCompany || !targetRole) {
      return res.status(400).json({
        error: '분석 대상 기업명과 지원 직무는 필수입니다.',
      });
    }

    if (!articleText && !sourceUrl) {
      return res.status(400).json({
        error: '분석할 기사 본문(articleText) 또는 웹 기사 URL(sourceUrl) 중 하나는 반드시 제공되어야 합니다.',
      });
    }

    if (streaming) {
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();
      send({ type: 'progress', stage: 'receiving', elapsedMs: 0 });
    }
    const workflowResult = await runJobNewsADKWorkflow({
      articleTitle: articleTitle || '선택한 뉴스 기사',
      articleText,
      sourceUrl,
      targetCompany,
      targetRole,
      industryTags,
      inputType,
    }, streaming ? (stage) => send({ type: 'progress', stage, elapsedMs: Date.now() - startedAt }) : undefined);

    if (streaming) {
      send({ type: 'result', result: workflowResult });
      return res.end();
    }
    return res.json(workflowResult);
  } catch (err: unknown) {
    console.error('Analyze article route error:', err);
    if (res.headersSent) {
      send({ type: 'error', message: `기사 분석 중 오류가 발생했습니다: ${err instanceof Error ? err.message : String(err)}` });
      return res.end();
    }
    return res.status(500).json({
      success: false,
      errorMessage: `기사 분석 중 오류가 발생했습니다: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
});
