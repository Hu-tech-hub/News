/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Bookmark, TargetProfile } from '../types';

export const SEED_TARGETS: TargetProfile[] = [
  {
    id: 'target-seed-1',
    companyName: '삼성전자',
    jobRole: '반도체 공정설계 (메모리사업부)',
    industryTags: ['반도체', '제조/장비'],
    createdAt: Date.now() - 3600000 * 24 * 3,
    updatedAt: Date.now() - 3600000 * 24 * 3,
  },
  {
    id: 'target-seed-2',
    companyName: '현대자동차',
    jobRole: '배터리 시스템 개발 (전동화)',
    industryTags: ['자동차/모빌리티', '배터리/화학'],
    createdAt: Date.now() - 3600000 * 24 * 5,
    updatedAt: Date.now() - 3600000 * 24 * 5,
  },
];

export const SEED_BOOKMARKS: Bookmark[] = [
  {
    id: 'bm-seed-1',
    title: '삼성전자, 평택 4공장(P4) 파운드리 및 첨단 패키징 라인 투자 재개 가속',
    sourceUrl: 'https://etnews.com/news/sample-p4-foundry',
    canonicalUrl: 'https://etnews.com/news/sample-p4-foundry',
    publisher: '전자신문',
    publishedAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    publishedDatePrecision: 'datetime',
    articleUpdatedAt: null,
    inputType: 'search',
    contentStatus: 'full_text_fetched',
    articleText: `삼성전자가 경기 평택캠퍼스 제4공장(P4) 파운드리(반도체 위탁생산) 및 첨단 패키징 라인 구축을 전격 재개한다. 복수의 반도체 장비 업계에 따르면 삼성전자는 최근 P4 페이즈2와 페이즈3에 대한 장비 발주를 재개했으며, 2nm 공정 라인 도입과 HBM4 16단 적층을 위한 패키징 클린룸 공사를 시작했다.
이번 투자는 AI 반도체 수요 급증에 따른 2세대 2나노 GAA(Gate-All-Around) 공정 수율 안정화와 차세대 HBM4 턴키 공급 능력을 조기에 확보하기 위한 조치로 풀이된다. 삼성전자는 2026년 하반기 시험 가동을 거쳐 2027년 초 양산을 목표로 하고 있다.`,
    industryTags: ['반도체', '제조/장비', 'AI반도체'],
    companyTags: ['삼성전자', 'TSMC'],
    issueTags: ['2나노GAA', 'HBM4', '평택P4', '첨단패키징'],
    summaryItems: [
      {
        factText: '삼성전자가 평택 제4공장(P4) 파운드리 및 첨단 패키징 라인 구축 및 장비 발주를 재개함.',
        sourceId: 'src-1',
        quoteSnippet: '삼성전자는 최근 P4 페이즈2와 페이즈3에 대한 장비 발주를 재개했으며',
      },
      {
        factText: '2나노 GAA 공정 및 HBM4 16단 적층을 겨냥하며 2026년 하반기 시험 가동, 2027년 초 양산 목표.',
        sourceId: 'src-1',
        quoteSnippet: '2026년 하반기 시험 가동을 거쳐 2027년 초 양산을 목표로 하고 있다.',
      },
    ],
    targetSnapshot: {
      companyName: '삼성전자',
      jobRole: '반도체 공정설계 (메모리사업부)',
      industryTags: ['반도체', '제조/장비'],
    },
    implications: [
      {
        factualBasis: 'P4 라인에서 HBM4 16단 적층 패키징 및 2나노 GAA 공정 라인 구축 재개.',
        companyImpact: '파운드리와 메모리(HBM)를 연계한 턴키 일괄 수주 경쟁력을 강화하는 전환점이 될 수 있음.',
        jobRoleChallenge:
          '공정설계 직무 관점에서 HBM4의 베이스 다이(Base Die) 파운드리 공정과 코어 메모리 다이 간 열 방출 및 극미세 팹 아웃 수율 확보가 핵심 과제로 부상함.',
        caveatsAndLimits:
          '장비 발주 단계이므로 실제 2나노 공정 수율 달성 여부와 양산 안정화 일정은 추가 확인이 필요함.',
        sourceId: 'src-1',
      },
    ],
    interviewQuestions: [
      {
        question:
          'HBM4부터는 베이스 다이에 파운드리 첨단 공정(4nm/2nm)이 적용되는데, 메모리 공정설계자로서 이종 집적 패키징 시 발생할 수 있는 열 팽창 계수(CTE) 불일치 문제에 어떻게 접근하시겠습니까?',
        intent: 'HBM4 기술 변화에 대한 이해도와 첨단 패키징 공정설계 실무 지식을 평가하기 위함.',
        sourceId: 'src-1',
        focusArea: 'tech',
      },
      {
        question:
          '기사에서 P4 라인의 2027년 양산 목표가 언급되었습니다. 신규 팹 라인 셋업 시 공정설계 엔지니어가 수율 램프업(Ramp-up)을 가속하기 위해 기여할 수 있는 구체적 방안은 무엇인가요?',
        intent: '양산 램프업 과정에서 공정 파라미터 최적화 및 불량 분석 역량을 확인하기 위함.',
        sourceId: 'src-1',
        focusArea: 'process',
      },
    ],
    sources: [
      {
        sourceId: 'src-1',
        title: '삼성전자, 평택 4공장(P4) 파운드리 및 첨단 패키징 라인 투자 재개 가속',
        url: 'https://etnews.com/news/sample-p4-foundry',
        publisher: '전자신문',
        publishedAt: new Date(Date.now() - 3600000 * 48).toISOString(),
        retrievedAt: new Date().toISOString(),
        sourceType: 'retrieved_article',
        verificationStatus: 'verified_url',
      },
    ],
    uncertainties: [
      'P4 공장 내 메모리(DRAM/낸드)와 파운드리 간 구체적인 면적 배분 비율은 공식 미공개 상태임.',
      '2나노 GAA 공정의 구체적인 고객사 수주 여부는 기사상 확인 불가.',
    ],
    analysisStatus: 'completed',
    analyzedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    modelId: 'gemini-3.1-flash-lite',
    promptVersion: 'v1.2.0-career-notes',
    createdAt: Date.now() - 3600000 * 24,
    updatedAt: Date.now() - 3600000 * 24,
    userNotes: '삼성전자 메모리사업부 1차 면접 전 HBM4 베이스다이 로직 공정 전환 이슈 숙지할 것!',
  },
];

export function getSampleSearchArticles(target?: TargetProfile | null): import('../types').SearchArticleItem[] {
  const comp = target?.companyName || '삼성전자';
  const role = target?.jobRole || '엔지니어링';
  const now = Date.now();
  return [
    {
      id: `sample-search-1-${now}`,
      title: `[기획] ${comp}, 차세대 공정 라인 장비 발주 확대 및 수율 안정화 가속`,
      publisher: '전자신문',
      sourceUrl: 'https://www.etnews.com/news/sample-fab-expansion',
      publishedAt: new Date(now - 3600000 * 24).toISOString().slice(0, 10),
      publishedDatePrecision: 'date',
      relationType: 'company_direct',
      selectionReason: `${comp} 직접 투자 및 설비 구축 관련 최신 핵심 동향`,
    },
    {
      id: `sample-search-2-${now}`,
      title: `글로벌 공급망 재편 속 ${role} 직무 관점의 핵심 품질·공정 과제 진단`,
      publisher: '한국경제',
      sourceUrl: 'https://www.hankyung.com/economy/sample-supply-chain',
      publishedAt: new Date(now - 3600000 * 48).toISOString().slice(0, 10),
      publishedDatePrecision: 'date',
      relationType: 'industry_role',
      selectionReason: `${role} 지원 직무와 직결되는 공정 및 기술 트렌드`,
    },
    {
      id: `sample-search-3-${now}`,
      title: `주요 테크·제조 기업 분기 실적 발표 및 신성장 동력 R&D 로드맵 공개`,
      publisher: '매일경제',
      sourceUrl: 'https://www.mk.co.kr/news/sample-tech-rd',
      publishedAt: new Date(now - 3600000 * 72).toISOString().slice(0, 10),
      publishedDatePrecision: 'date',
      relationType: 'company_direct',
      selectionReason: `경영 전략 및 차세대 기술군 개발 방향성 파악`,
    },
  ];
}

export function getSampleArticleText(target?: TargetProfile | null): { title: string; url: string; text: string } {
  const comp = target?.companyName || '삼성전자';
  return {
    title: `${comp}, 차세대 고성능 반도체 및 첨단 패키징 라인 대규모 투자 발표`,
    url: 'https://www.etnews.com/sample-article',
    text: `${comp}가 차세대 고성능 칩 양산을 위해 첨단 공정 클린룸 및 신규 설비 증설 계획을 확정 발표했다. 업계에 따르면 이번 투자는 차세대 패키징 수율을 극대화하고 전력 효율을 25% 개선하는 신소재 공정을 도입하는 데 초점이 맞춰져 있다. 관계자는 "글로벌 고객사의 맞춤형 요구에 적기 대응하기 위해 선행 R&D 및 제조 품질 표준화 체계를 구축할 것"이라고 밝혔다. 이는 급증하는 고대역폭 메모리와 AI 가속기 시장에서의 점유율 방어 및 주도권 확보를 위한 핵심 행보로 분석된다.`,
  };
}
