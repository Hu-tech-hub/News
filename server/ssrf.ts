/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import dns from 'node:dns/promises';
import { SERVER_CONFIG } from './config.js';
import { resolveGoogleNewsUrl } from './google-news.js';

function isPrivateIp(ip: string): boolean {
  // IPv4 checks
  if (ip.startsWith('127.')) return true;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('169.254.')) return true;
  if (ip.startsWith('0.')) return true;

  const parts = ip.split('.').map(Number);
  if (parts.length === 4) {
    // 172.16.0.0 – 172.31.255.255
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 100.64.0.0 - 100.127.255.255 (CGNAT)
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
  }

  // IPv6 checks
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::' || lower.startsWith('fe80:') || lower.startsWith('fc00:') || lower.startsWith('fd00:')) {
    return true;
  }

  return false;
}

export async function validateSafeUrl(urlStr: string): Promise<{ safe: boolean; error?: string; urlObj?: URL }> {
  let urlObj: URL;
  try {
    urlObj = new URL(urlStr);
  } catch {
    return { safe: false, error: '유효한 URL 형식이 아닙니다.' };
  }

  if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
    return { safe: false, error: 'HTTP 및 HTTPS 프로토콜만 허용됩니다.' };
  }

  const hostname = urlObj.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    return { safe: false, error: '로컬 및 사설 네트워크 주소는 접근이 제한됩니다.' };
  }

  try {
    const lookup = await dns.lookup(hostname);
    if (isPrivateIp(lookup.address)) {
      return { safe: false, error: '사설 또는 예약된 IP 주소(SSRF 방지)는 접근할 수 없습니다.' };
    }
  } catch {
    return { safe: false, error: '호스트 이름을 확인할 수 없습니다.' };
  }

  return { safe: true, urlObj };
}

function findMarkedArticleBody(html: string): string | undefined {
  const start = /<(article|div|section)\b[^>]*\s(?:itemprop\s*=\s*["']articleBody["']|id\s*=\s*["']article-view-content-div["'])[^>]*>/i.exec(html);
  if (!start) return;

  const offset = start.index + start[0].length;
  const tag = start[1];
  const tags = new RegExp('</?' + tag + '\\b[^>]*>', 'gi');
  tags.lastIndex = offset;
  let depth = 1;
  for (let match = tags.exec(html); match; match = tags.exec(html)) {
    depth += match[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return html.slice(offset, match.index);
  }
}

function cleanHtmlToText(html: string): { title: string; text: string } {
  // Extract title tag
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  let title = titleMatch ? titleMatch[1].trim() : '';
  title = title.replace(/\s+/g, ' ');

  // Remove scripts, styles, noscripts, iframes, svgs, header, footer, nav
  let cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, ' ')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
    .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, ' ');

  const markedBody = findMarkedArticleBody(cleaned);
  if (markedBody) {
    cleaned = markedBody;
  } else {
    const articleMatch = cleaned.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch && articleMatch[1].length > 200) cleaned = articleMatch[1];
  }

  // Replace block tags with newlines
  cleaned = cleaned.replace(/<(?:p|div|br|h1|h2|h3|h4|h5|h6|li|tr)[^>]*>/gi, '\n');
  // Strip all other HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, ' ');
  // Decode basic HTML entities
  cleaned = cleaned
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Normalize whitespace
  const lines = cleaned
    .split('\n')
    .map((l) => l.trim().replace(/\s+/g, ' '))
    .filter((l) => l.length > 0);

  const text = lines.join('\n');
  return { title, text };
}

export async function fetchSafeArticle(
  urlStr: string,
  redirectCount = 0
): Promise<{ success: boolean; title?: string; text?: string; error?: string; sourceUrl?: string }> {
  if (redirectCount > SERVER_CONFIG.MAX_REDIRECTS) {
    return { success: false, error: '최대 리다이렉트 횟수(3회)를 초과했습니다.' };
  }

  const check = await validateSafeUrl(urlStr);
  if (!check.safe) {
    return { success: false, error: check.error };
  }

  if (new URL(urlStr).hostname === 'news.google.com') {
    try {
      const publisherUrl = await resolveGoogleNewsUrl(urlStr);
      const result = await fetchSafeArticle(publisherUrl, redirectCount + 1);
      return { ...result, sourceUrl: result.sourceUrl || publisherUrl };
    } catch (error) {
      return { success: false, error: `원문 자동 연결 실패: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SERVER_CONFIG.FETCH_URL_TIMEOUT_MS);

  try {
    const res = await fetch(urlStr, {
      signal: controller.signal,
      redirect: 'manual',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 JobNewsNotes/1.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    clearTimeout(timeoutId);

    // Handle redirects manually to re-validate each hop against SSRF rules
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) {
        return { success: false, error: '리다이렉트 주소가 비어있습니다.' };
      }
      const nextUrl = new URL(location, urlStr).toString();
      return fetchSafeArticle(nextUrl, redirectCount + 1);
    }

    if (!res.ok) {
      return {
        success: false,
        sourceUrl: urlStr,
        error: `기사 페이지 접근 오류 (HTTP ${res.status}): 언론사 유료벽이나 봇 차단 정책이 적용된 페이지일 수 있습니다. 본문을 직접 복사하여 입력해주세요.`,
      };
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return { success: false, error: 'HTML 웹 기사 형식이 아닙니다.' };
    }

    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > SERVER_CONFIG.MAX_ARTICLE_BYTES) {
      return { success: false, error: '문서 크기가 너무 큽니다 (최대 1MB 초과).' };
    }

    const decoder = new TextDecoder('utf-8');
    const html = decoder.decode(arrayBuffer);

    const { title, text } = cleanHtmlToText(html);

    if (text.length < 100) {
      return {
        success: false,
        error:
          '충분한 본문 텍스트를 추출하지 못했습니다 (유료벽, 동적 스크립트 렌더링 또는 로그인 필요). 본문을 직접 붙여넣어 주세요.',
      };
    }

    return {
      success: true,
      sourceUrl: urlStr,
      title,
      text: text.slice(0, SERVER_CONFIG.MAX_ARTICLE_CHARS),
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      return { success: false, error: '기사 페이지 응답 시간이 초과되었습니다 (9초).' };
    }
    return {
      success: false,
      error: `본문 수집 실패: ${err instanceof Error ? err.message : String(err)}. 본문을 직접 입력해 분석을 진행할 수 있습니다.`,
    };
  }
}
