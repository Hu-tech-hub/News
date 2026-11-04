/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SearchArticleItem } from '../types';
import { normalizeArticleUrl } from './url';

/**
 * Extracts normalized core tokens from Korean titles for topic clustering
 */
function extractTitleTokens(title: string): Set<string> {
  const cleaned = title
    .replace(/[\[\]\(\)\<\>\"\'·,\.\?\!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  const stopWords = new Set(['등', '및', '위한', '통해', '관련', '대한', '오늘', '내일', '주요', '단독', '속보']);
  const tokens = cleaned.split(' ').filter((w) => w.length >= 2 && !stopWords.has(w));
  return new Set(tokens);
}

/**
 * Calculates Jaccard similarity between two sets of title tokens
 */
function calculateTokenOverlap(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Identifies whether an article is a follow-up or development
 */
function isFollowUpCoverage(title: string): boolean {
  const followUpKeywords = ['후속', '이후', '진행', '결과', '발표 후', '착공', '양산 개시', '2차', '최종', '승인'];
  return followUpKeywords.some((kw) => title.includes(kw));
}

/**
 * Groups identical articles by canonical URL and clusters same-event articles,
 * keeping original links and highlighting follow-up coverage.
 */
export function clusterAndDeduplicateArticles(articles: SearchArticleItem[]): SearchArticleItem[] {
  // 1. Group exact URL matches
  const urlMap = new Map<string, SearchArticleItem>();
  for (const art of articles) {
    const normUrl = normalizeArticleUrl(art.sourceUrl);
    if (!urlMap.has(normUrl)) {
      urlMap.set(normUrl, { ...art, sourceUrl: normUrl });
    }
  }

  const uniqueArticles = Array.from(urlMap.values());
  const visited = new Set<string>();
  const clustered: SearchArticleItem[] = [];

  for (let i = 0; i < uniqueArticles.length; i++) {
    const current = uniqueArticles[i];
    if (visited.has(current.id)) continue;

    visited.add(current.id);
    const tokensCurrent = extractTitleTokens(current.title);
    const relatedList: Array<{
      title: string;
      publisher: string;
      sourceUrl: string;
      publishedAt: string | null;
      isFollowUp?: boolean;
      note?: string;
    }> = [];

    for (let j = i + 1; j < uniqueArticles.length; j++) {
      const other = uniqueArticles[j];
      if (visited.has(other.id)) continue;

      const tokensOther = extractTitleTokens(other.title);
      const similarity = calculateTokenOverlap(tokensCurrent, tokensOther);

      // Overlap threshold for same event (e.g. >= 0.45 overlap with at least 3 matching keywords)
      let matchCount = 0;
      for (const t of tokensCurrent) {
        if (tokensOther.has(t)) matchCount++;
      }

      if (similarity >= 0.45 && matchCount >= 2) {
        visited.add(other.id);
        const followUp = isFollowUpCoverage(other.title);
        relatedList.push({
          title: other.title,
          publisher: other.publisher,
          sourceUrl: other.sourceUrl,
          publishedAt: other.publishedAt,
          isFollowUp: followUp,
          note: followUp ? '후속 진행 보도' : '동일 사건 관련 보도',
        });
      }
    }

    if (relatedList.length > 0) {
      clustered.push({
        ...current,
        relatedArticles: relatedList,
      });
    } else {
      clustered.push(current);
    }
  }

  return clustered;
}
