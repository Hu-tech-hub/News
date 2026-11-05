import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNewsFeed } from './news.js';

const params = { companyName: '삼성전자', jobRole: '공정', industryTags: ['반도체'], timeframe: 'last_7_days' as const };
const now = new Date('2026-11-05T01:00:00Z');
test('RSS preserves publisher/date, decodes entities, excludes missing and old dates and unsafe links', () => {
  const result = parseNewsFeed(`<rss><channel>
    <item><title>삼성전자 투자 &amp; 생산 - 뉴스사</title><link>https://news.google.com/rss/articles/one</link><pubDate>Wed, 04 Nov 2026 03:00:00 GMT</pubDate><source url="https://example.com">뉴스사</source></item>
    <item><title>오래된 기사</title><link>https://news.google.com/rss/articles/old</link><pubDate>Wed, 01 Oct 2025 03:00:00 GMT</pubDate></item>
    <item><title>날짜 없음</title><link>https://news.google.com/rss/articles/missing</link></item>
    <item><title>잘못된 링크</title><link>javascript:alert(1)</link><pubDate>Wed, 04 Nov 2026 03:00:00 GMT</pubDate></item>
  </channel></rss>`, params, now);
  assert.equal(result.articles.length, 1);
  assert.equal(result.articles[0].title, '삼성전자 투자 & 생산');
  assert.equal(result.articles[0].publisher, '뉴스사');
  assert.equal(result.articles[0].publishedAt, '2026-11-04T03:00:00.000Z');
  assert.equal(result.excludedCountMissingDate, 1);
  assert.equal(result.excludedCountOutOfRange, 1);
});
test('RSS accepts empty results and rejects a non-feed response', () => {
  assert.equal(parseNewsFeed('<rss><channel><title>검색</title></channel></rss>', params, now).articles.length, 0);
  assert.throws(() => parseNewsFeed('<html>error</html>', params, now));
});
