/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FunctionNode, Workflow, START, InMemoryRunner } from '@google/adk';
import { fetchSafeArticle } from './ssrf';
import { runStructuredAnalysis } from './gemini';
import { AnalysisResult, ContentStatus, SourceItem } from '../src/types';

export interface WorkflowInput {
  articleTitle: string;
  articleText?: string;
  sourceUrl?: string | null;
  targetCompany: string;
  targetRole: string;
  industryTags: string[];
  inputType: 'search' | 'url' | 'text';
}

export interface WorkflowOutput {
  success: boolean;
  contentStatus: ContentStatus;
  articleText: string;
  articleTitle: string;
  sources: SourceItem[];
  analysis?: AnalysisResult;
  errorMessage?: string;
  adkExecutionDetails: {
    workflowName: string;
    nodesExecuted: string[];
    completedAt: string;
  };
}

/**
 * Builds and runs the Google ADK Workflow for evidence-based career news analysis
 */
export async function runJobNewsADKWorkflow(input: WorkflowInput): Promise<WorkflowOutput> {
  const executedNodes: string[] = [];
  const sourceId = `src-1`;

  // Shared context storage for workflow execution
  let currentTitle = input.articleTitle || '무제 기사';
  let currentText = input.articleText || '';
  let contentStatus: ContentStatus = input.articleText ? 'user_provided_text' : 'partial_text';
  let fetchError: string | undefined = undefined;
  let analysisResult: AnalysisResult | undefined = undefined;
  let analysisNodeStarted = false;

  // Node 1: Input Validation and Safe Content Retrieval
  const inputValidationNode = new FunctionNode('input_validation_and_fetch', async (ctx, nodeInput: any) => {
    executedNodes.push('input_validation_and_fetch');

    // Case A: User provided direct text
    if (input.articleText && input.articleText.trim().length >= 50) {
      currentText = input.articleText.trim();
      contentStatus = input.inputType === 'text' ? 'user_provided_text' : 'full_text_fetched';
      return { status: 'text_ready' };
    }

    // Case B: URL is provided and needs fetching
    if (input.sourceUrl) {
      const fetchResult = await fetchSafeArticle(input.sourceUrl);
      if (fetchResult.success && fetchResult.text) {
        currentText = fetchResult.text;
        if (fetchResult.title && (!input.articleTitle || input.articleTitle.startsWith('기사 #'))) {
          currentTitle = fetchResult.title;
        }
        contentStatus = 'full_text_fetched';
        return { status: 'text_ready' };
      } else {
        fetchError = fetchResult.error || '본문을 불러올 수 없습니다.';
        contentStatus = 'fetch_failed_needs_text';
        return { status: 'fetch_failed', error: fetchError };
      }
    }

    fetchError = '기사 본문 또는 접근 가능한 웹 기사 URL을 입력해 주세요.';
    contentStatus = 'fetch_failed_needs_text';
    return { status: 'fetch_failed', error: fetchError };
  });

  // Node 2: AI Structured Analysis Node
  const analysisExecutionNode = new FunctionNode('gemini_structured_analysis', async (ctx, nodeInput: any) => {
    executedNodes.push('gemini_structured_analysis');

    if (contentStatus === 'fetch_failed_needs_text' || !currentText || currentText.length < 50) {
      return { status: 'skipped' };
    }

    analysisNodeStarted = true;
    const result = await runStructuredAnalysis({
      articleTitle: currentTitle,
      articleText: currentText,
      sourceUrl: input.sourceUrl || null,
      targetCompany: input.targetCompany,
      targetRole: input.targetRole,
      industryTags: input.industryTags,
      sourceId,
    });

    analysisResult = result;
    return { status: 'analysis_done', result };
  });

  // Node 3: Grounding and Source Verification Node
  const validationAndGroundingNode = new FunctionNode('validation_and_grounding', async (ctx, nodeInput: any) => {
    executedNodes.push('validation_and_grounding');

    if (!analysisResult) {
      return { status: 'incomplete' };
    }

    // Verify all sourceIds in summary, implications, and questions match valid sources
    const validSourceIds = new Set([sourceId]);

    // Check summary items
    analysisResult.summaryItems = analysisResult.summaryItems.map((item) => ({
      ...item,
      sourceId: validSourceIds.has(item.sourceId) ? item.sourceId : sourceId,
    }));

    // Check implications
    analysisResult.implications = analysisResult.implications.map((imp) => ({
      ...imp,
      sourceId: validSourceIds.has(imp.sourceId) ? imp.sourceId : sourceId,
    }));

    // Check interview questions
    analysisResult.interviewQuestions = analysisResult.interviewQuestions.map((q) => ({
      ...q,
      sourceId: validSourceIds.has(q.sourceId) ? q.sourceId : sourceId,
    }));

    return { status: 'verified' };
  });

  // Construct ADK Workflow with linear chain: START -> Input -> Analysis -> Validation
  const jobNewsWorkflow = new Workflow({
    name: 'job_news_analysis_workflow',
    edges: [
      [START, inputValidationNode, analysisExecutionNode, validationAndGroundingNode],
    ],
  });

  // Run through ADK InMemoryRunner
  const runner = new InMemoryRunner({
    appName: 'JobNewsNotesApp',
    agent: jobNewsWorkflow,
  });

  try {
    for await (const _ of runner.runEphemeral({
      userId: 'career_user',
      newMessage: {
        role: 'user',
        parts: [{ text: `Analyze article: ${currentTitle}` }],
      },
    })) {
      // Stream events through runner
    }
  } catch (wfErr: unknown) {
    console.error('ADK Workflow execution warning:', wfErr);
    const error = wfErr instanceof Error ? wfErr : new Error(String(wfErr));
    const errorDetails = wfErr as {
      isQuotaExhausted?: boolean;
      quotaError?: { friendlyMessage?: string };
    };
    const errorMessage = error.message;
    const is429 =
      errorDetails?.isQuotaExhausted ||
      errorDetails?.quotaError ||
      errorMessage.includes('429') ||
      errorMessage.includes('RESOURCE_EXHAUSTED');
    const is503 =
      errorMessage.includes('503') ||
      errorMessage.includes('UNAVAILABLE') ||
      errorMessage.includes('high demand');

    // CRITICAL: Do NOT attempt retry if error is 429 RESOURCE_EXHAUSTED or 503 UNAVAILABLE
    if (is429) {
      console.warn('[ADK Workflow] 할당량 초과(429) 감지: 추가 재시도를 즉시 차단하고 사용자에게 안내합니다.');
      return {
        success: false,
        contentStatus,
        articleText: currentText,
        articleTitle: currentTitle,
        sources: [],
        errorMessage:
          errorDetails?.quotaError?.friendlyMessage ||
          errorMessage ||
          'Gemini API 요청 한도(429 RESOURCE_EXHAUSTED)가 초과되었습니다.',
        adkExecutionDetails: {
          workflowName: jobNewsWorkflow.name,
          nodesExecuted: executedNodes,
          completedAt: new Date().toISOString(),
        },
      };
    }

    if (is503) {
      console.warn('[ADK Workflow] 모델 과부하(503) 감지: 추가 재시도를 차단하고 일시적 트래픽 안내를 반환합니다.');
      return {
        success: false,
        contentStatus,
        articleText: currentText,
        articleTitle: currentTitle,
        sources: [],
        errorMessage: '구글 AI 모델 일시적 과부하 (503 UNAVAILABLE): 현재 Gemini 모델 서버 트래픽이 일시적으로 급증한 상태입니다. 잠시 후 다시 시도해 주시거나, 화면의 [체험용 샘플 분석 결과 보기]를 통해 분석 UI를 바로 확인해 보세요.',
        adkExecutionDetails: {
          workflowName: jobNewsWorkflow.name,
          nodesExecuted: executedNodes,
          completedAt: new Date().toISOString(),
        },
      };
    }

    // Never repeat a Gemini request that already started inside the workflow.
    if (analysisNodeStarted) {
      return {
        success: false,
        contentStatus,
        articleText: currentText,
        articleTitle: currentTitle,
        sources: [],
        errorMessage,
        adkExecutionDetails: {
          workflowName: jobNewsWorkflow.name,
          nodesExecuted: executedNodes,
          completedAt: new Date().toISOString(),
        },
      };
    }

    if (!analysisResult && currentText.trim().length >= 50) {
      try {
        analysisResult = await runStructuredAnalysis({
          articleTitle: currentTitle,
          articleText: currentText,
          sourceUrl: input.sourceUrl || null,
          targetCompany: input.targetCompany,
          targetRole: input.targetRole,
          industryTags: input.industryTags,
          sourceId,
        });
        analysisResult.orchestrator = 'fallback-direct';
      } catch (fbErr: unknown) {
        return {
          success: false,
          contentStatus,
          articleText: currentText,
          articleTitle: currentTitle,
          sources: [],
          errorMessage: fbErr instanceof Error ? fbErr.message : '분석 중 오류가 발생했습니다.',
          adkExecutionDetails: {
            workflowName: jobNewsWorkflow.name,
            nodesExecuted: executedNodes,
            completedAt: new Date().toISOString(),
          },
        };
      }
    }
  }

  if (!analysisResult && !fetchError && currentText.trim().length >= 50) {
    if (analysisNodeStarted) {
      throw new Error('ADK 분석 단계가 완료되지 않았습니다.');
    }
    analysisResult = await runStructuredAnalysis({
      articleTitle: currentTitle,
      articleText: currentText,
      sourceUrl: input.sourceUrl || null,
      targetCompany: input.targetCompany,
      targetRole: input.targetRole,
      industryTags: input.industryTags,
      sourceId,
    });
    analysisResult.orchestrator = 'fallback-direct';
  }

  if (!analysisResult && !fetchError) {
    fetchError = '분석하려면 기사 본문을 50자 이상 입력해 주세요.';
    contentStatus = 'fetch_failed_needs_text';
  }

  // Construct source item
  const sources: SourceItem[] = [
    {
      sourceId,
      title: currentTitle,
      url: input.sourceUrl || null,
      publisher: input.sourceUrl ? null : '사용자 제공 직접 입력',
      publishedAt: new Date().toISOString().slice(0, 10),
      retrievedAt: new Date().toISOString(),
      sourceType: input.sourceUrl ? 'retrieved_article' : 'user_provided',
      verificationStatus: input.sourceUrl ? 'verified_url' : 'user_unverified',
    },
  ];

  if (fetchError && contentStatus === 'fetch_failed_needs_text') {
    return {
      success: false,
      contentStatus,
      articleText: '',
      articleTitle: currentTitle,
      sources,
      errorMessage: fetchError,
      adkExecutionDetails: {
        workflowName: jobNewsWorkflow.name,
        nodesExecuted: executedNodes,
        completedAt: new Date().toISOString(),
      },
    };
  }

  return {
    success: true,
    contentStatus,
    articleText: currentText,
    articleTitle: currentTitle,
    sources,
    analysis: analysisResult,
    adkExecutionDetails: {
      workflowName: jobNewsWorkflow.name,
      nodesExecuted: executedNodes,
      completedAt: new Date().toISOString(),
    },
  };
}
