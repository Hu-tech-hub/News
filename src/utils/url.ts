/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'fbclid',
  'gclid',
  '_hsenc',
  '_hsmi',
  'mc_cid',
  'mc_eid',
  'igshid',
  'ref',
  'ref_src',
  'source',
  'sns',
  'feed',
  'cmpid',
]);

/**
 * Strips tracking parameters and fragment hashes while preserving essential query parameters.
 */
export function normalizeArticleUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  try {
    const url = new URL(trimmed);

    // Remove hash/fragment
    url.hash = '';

    // Remove known tracking query parameters
    const searchParams = new URLSearchParams(url.search);
    const keysToDelete: string[] = [];
    searchParams.forEach((_, key) => {
      if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith('utm_')) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => searchParams.delete(key));
    url.search = searchParams.toString();

    // Remove trailing slash for root paths or normalize
    let result = url.toString();
    if (result.endsWith('/') && url.pathname === '/') {
      result = result.slice(0, -1);
    }
    return result;
  } catch {
    // If not a valid URL, return trimmed original without fragment
    return trimmed.split('#')[0];
  }
}

/**
 * Extracts a friendly publisher or host name from URL
 */
export function extractDomainPublisher(urlStr: string): string {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.replace(/^www\./, '');
    const knownPublishers: Record<string, string> = {
      'chosun.com': '조선일보',
      'joongang.co.kr': '중앙일보',
      'donga.com': '동아일보',
      'hani.co.kr': '한겨레',
      'khan.co.kr': '경향신문',
      'mk.co.kr': '매일경제',
      'hankyung.com': '한국경제',
      'sedaily.com': '서울경제',
      'etnews.com': '전자신문',
      'zdnet.co.kr': 'ZDNet Korea',
      'bloter.net': '블로터',
      'yna.co.kr': '연합뉴스',
      'newsis.com': '뉴시스',
      'news1.kr': '뉴스1',
      'thelec.kr': '디일렉',
      'ddaily.co.kr': '디지털데일리',
    };

    for (const [domain, name] of Object.entries(knownPublishers)) {
      if (host.includes(domain)) return name;
    }

    return host;
  } catch {
    return '언론사 미확인';
  }
}
