import { XMLParser } from 'fast-xml-parser';
import type { SearchArticleItem, TimeframeOption } from '../src/types/index.js';
import { checkArticleRecency, formatToKST } from '../src/utils/date.js';
import { clusterAndDeduplicateArticles } from '../src/utils/dedup.js';
import { SERVER_CONFIG } from './config.js';

export interface NewsSearchParams {
  companyName: string;
  jobRole: string;
  industryTags: string[];
  extraKeyword?: string;
  timeframe: TimeframeOption;
}

// Only parse the fixed Google News endpoint; never fetch a URL supplied by a user.
export function parseNewsFeed(xml: string, params: NewsSearchParams, now = new Date()) {
  const feed = new XMLParser({ ignoreAttributes: true, processEntities: true }).parse(xml);
  if (!feed?.rss?.channel) throw new Error('뉴스 피드 응답 형식이 올바르지 않습니다.');
  const items = feed.rss.channel.item;
  const entries = items ? (Array.isArray(items) ? items : [items]) : [];
  const articles: SearchArticleItem[] = [];
  let excludedCountMissingDate = 0;
  let excludedCountOutOfRange = 0;
  for (const item of entries) {
    const date = typeof item.pubDate === 'string' ? item.pubDate : null;
    const recency = checkArticleRecency(date, params.timeframe, now);
    if (!recency.isValid) {
      if (recency.reason === 'missing_date') excludedCountMissingDate++;
      else excludedCountOutOfRange++;
      continue;
    }
    if (typeof item.title !== 'string' || typeof item.link !== 'string') continue;
    let url: URL;
    try { url = new URL(item.link); } catch { continue; }
    if (url.protocol !== 'https:' || url.hostname !== 'news.google.com') continue;
    const publisher = typeof item.source === 'string' ? item.source : '출처 미상';
    const suffix = ` - ${publisher}`;
    const title = item.title.endsWith(suffix) ? item.title.slice(0, -suffix.length) : item.title;
    const direct = title.includes(params.companyName);
    articles.push({
      id: `rss-${articles.length}-${now.getTime()}`,
      title, publisher, sourceUrl: url.href,
      publishedAt: new Date(date!).toISOString(), publishedDatePrecision: 'datetime',
      relationType: direct ? 'company_direct' : 'industry_role',
      selectionReason: direct ? `${params.companyName} 기업명으로 검색된 기사` : '관심 기업·산업 검색 결과 (직무 관련성은 본문 확인 필요)',
    });
  }
  articles.sort((a, b) => new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime());
  return { articles: clusterAndDeduplicateArticles(articles),
    excludedCountMissingDate, excludedCountOutOfRange, totalFoundRaw: entries.length };
}

export async function searchRealNews(params: NewsSearchParams) {
  const now = new Date();
  const days = params.timeframe === 'today' ? 1 : params.timeframe === 'last_7_days' ? 7 : 30;
  // Role labels are not always present in headlines; search the company and optional
  // explicit keyword, while the saved role guides subsequent article analysis.
  const query = [params.companyName, params.extraKeyword || '', `when:${days}d`].filter(Boolean).join(' ');
  const url = new URL('https://news.google.com/rss/search');
  url.search = new URLSearchParams({ q: query, hl: 'ko', gl: 'KR', ceid: 'KR:ko' }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(SERVER_CONFIG.SEARCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Google 뉴스 피드 조회 실패 (HTTP ${response.status})`);
  const xml = await response.text();
  if (xml.length > 2_000_000) throw new Error('뉴스 피드 응답이 너무 큽니다.');
  return { ...parseNewsFeed(xml, params, now), searchTimeKST: formatToKST(now, 'datetime'),
    timeframe: params.timeframe, queryUsed: query, isGroundingLive: false,
    notes: 'Google 뉴스 RSS 검색 결과입니다. 분석할 기사를 선택하면 언론사 원문을 자동으로 불러옵니다. 뉴스 검색은 Gemini API 한도를 사용하지 않으며, AI 분석에는 별도의 무료 한도가 적용됩니다.' };
}
