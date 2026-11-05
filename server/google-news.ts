// Google News' article-link protocol. Reference implementation:
// https://github.com/SSujitX/google-news-url-decoder
// Decode only the selected article, never every result in the feed.
export function googleNewsArticleId(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'news.google.com' || url.port || url.username || url.password) return null;
    return url.pathname.match(/^\/(?:rss\/articles|articles|read)\/([A-Za-z0-9_-]+)\/?$/)?.[1] || null;
  } catch { return null; }
}

export function parsePublisherResponse(text: string): string {
  // batchexecute responses may contain an anti-XSSI prefix and byte-length lines.
  for (const line of text.split('\n')) {
    if (!line.trim().startsWith('[')) continue;
    let rows: unknown;
    try { rows = JSON.parse(line); } catch { continue; }
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!Array.isArray(row) || row[0] !== 'wrb.fr' || row[1] !== 'Fbv4je' || typeof row[2] !== 'string') continue;
      let payload: unknown;
      try { payload = JSON.parse(row[2]); } catch { continue; }
      if (!Array.isArray(payload) || payload[0] !== 'garturlres' || typeof payload[1] !== 'string') continue;
      const url = new URL(payload[1]);
      if (!['http:', 'https:'].includes(url.protocol) || url.hostname === 'news.google.com' || url.username || url.password) continue;
      // The caller must validate DNS/private addresses before fetching this URL.
      return url.href;
    }
  }
  throw new Error('Google 뉴스에서 언론사 원문 주소를 확인하지 못했습니다.');
}

export async function resolveGoogleNewsUrl(value: string): Promise<string> {
  const id = googleNewsArticleId(value);
  if (!id) throw new Error('지원하지 않는 Google 뉴스 기사 주소입니다.');
  const signal = AbortSignal.timeout(10_000);
  const pageUrl = new URL(`https://news.google.com/rss/articles/${id}`);
  pageUrl.search = new URLSearchParams({ hl: 'ko', gl: 'KR', ceid: 'KR:ko' }).toString();
  const page = await fetch(pageUrl, { signal, redirect: 'error' });
  if (!page.ok) throw new Error(`원문 주소 조회 실패 (HTTP ${page.status})`);
  const html = await page.text();
  const signature = html.match(/data-n-a-sg="([^"]+)"/)?.[1];
  const timestamp = html.match(/data-n-a-ts="(\d+)"/)?.[1];
  if (!signature || !timestamp) throw new Error('Google 뉴스 원문 연결 정보를 찾지 못했습니다.');
  const context = [
    ['X', 'X', ['X', 'X'], null, null, 1, 1, 'KR:ko', null, 1, null, null, null, null, null, 0, 1],
    'X', 'X', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0,
  ];
  const request = ['garturlreq', context, id, Number(timestamp), signature];
  const response = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
    method: 'POST', signal, redirect: 'error',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams({ 'f.req': JSON.stringify([[['Fbv4je', JSON.stringify(request), null, '0']]]) }),
  });
  if (!response.ok) throw new Error(`원문 주소 변환 실패 (HTTP ${response.status})`);
  return parsePublisherResponse(await response.text());
}
