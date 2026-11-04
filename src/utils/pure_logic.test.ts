/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { checkArticleRecency, getTimeframeBounds, formatToKST } from './date';
import { normalizeArticleUrl, extractDomainPublisher } from './url';
import { clusterAndDeduplicateArticles } from './dedup';
import { SearchArticleItem } from '../types';

test('URL normalization strips tracking params and fragments', () => {
  const dirtyUrl = 'https://n.news.naver.com/mnews/article/001/001?utm_source=twitter&fbclid=abc1234&id=999#main_content';
  const cleanUrl = normalizeArticleUrl(dirtyUrl);
  assert.equal(cleanUrl, 'https://n.news.naver.com/mnews/article/001/001?id=999');

  const cleanNoFragment = normalizeArticleUrl('https://example.com/article/123#reply-section');
  assert.equal(cleanNoFragment, 'https://example.com/article/123');
});

test('Domain publisher extraction identifies known Korean outlets', () => {
  assert.equal(extractDomainPublisher('https://www.chosun.com/economy/1'), '조선일보');
  assert.equal(extractDomainPublisher('https://m.sedaily.com/NewsView/ABC'), '서울경제');
  assert.equal(extractDomainPublisher('https://unknown-tech-blog.org/post'), 'unknown-tech-blog.org');
});

test('Recency validation accepts valid dates within timeframe and rejects old or missing dates', () => {
  const ref = new Date('2026-11-04T12:00:00Z');

  // Article from 2 days ago
  const valid2DaysAgo = new Date('2026-11-02T12:00:00Z').toISOString();
  const res7 = checkArticleRecency(valid2DaysAgo, 'last_7_days', ref);
  assert.equal(res7.isValid, true);

  // Article from 10 days ago (valid for 30 days, invalid for 7 days)
  const old10DaysAgo = new Date('2026-10-25T12:00:00Z').toISOString();
  const res7Old = checkArticleRecency(old10DaysAgo, 'last_7_days', ref);
  assert.equal(res7Old.isValid, false);
  assert.equal(res7Old.reason, 'too_old');

  const res30Old = checkArticleRecency(old10DaysAgo, 'last_30_days', ref);
  assert.equal(res30Old.isValid, true);

  // Missing or invalid date
  assert.equal(checkArticleRecency(null, 'last_7_days', ref).isValid, false);
  assert.equal(checkArticleRecency('not-a-date', 'last_7_days', ref).isValid, false);

  // Far future date (e.g. year 2099)
  const futureDate = new Date('2099-01-01T00:00:00Z').toISOString();
  const resFuture = checkArticleRecency(futureDate, 'last_7_days', ref);
  assert.equal(resFuture.isValid, false);
  assert.equal(resFuture.reason, 'future_date');
});

test('Article deduplication and event clustering groups related articles', () => {
  const articles: SearchArticleItem[] = [
    {
      id: '1',
      title: '삼성전자 평택 4공장 파운드리 클린룸 구축 재개',
      publisher: '전자신문',
      sourceUrl: 'https://etnews.com/news/1?utm_source=feed',
      publishedAt: '2026-11-02T10:00:00Z',
      publishedDatePrecision: 'datetime',
      relationType: 'company_direct',
      selectionReason: '삼성전자 파운드리 시설 투자 재개',
    },
    {
      id: '2',
      title: '삼성전자 평택 4공장 파운드리 클린룸 투자 전격 재개',
      publisher: '디일렉',
      sourceUrl: 'https://thelec.kr/news/2',
      publishedAt: '2026-11-02T11:00:00Z',
      publishedDatePrecision: 'datetime',
      relationType: 'company_direct',
      selectionReason: '동일 설비 투자',
    },
    {
      id: '3',
      title: '현대차 SDV 소프트웨어 중심 자동차 전환 가속화',
      publisher: '한국경제',
      sourceUrl: 'https://hankyung.com/news/3',
      publishedAt: '2026-11-03T09:00:00Z',
      publishedDatePrecision: 'datetime',
      relationType: 'industry_role',
      selectionReason: '자동차 SDV 트렌드',
    },
  ];

  const clustered = clusterAndDeduplicateArticles(articles);
  assert.equal(clustered.length, 2); // 1 and 2 clustered together, 3 separate
  assert.equal(clustered[0].relatedArticles?.length, 1);
  assert.equal(clustered[0].relatedArticles?.[0].publisher, '디일렉');
});
