import { test } from 'node:test';
import assert from 'node:assert/strict';
import { googleNewsArticleId, parsePublisherResponse } from './google-news.js';

test('accepts Google News article formats and rejects other hosts or paths', () => {
  for (const path of ['rss/articles', 'articles', 'read']) {
    assert.equal(googleNewsArticleId(`https://news.google.com/${path}/CBMi_123?oc=5`), 'CBMi_123');
  }
  for (const url of ['https://news.google.com.evil.test/articles/id', 'https://example.com/articles/id', 'https://news.google.com/rss/search?q=x', 'https://user@news.google.com/articles/id', 'http://news.google.com/articles/id']) {
    assert.equal(googleNewsArticleId(url), null);
  }
});
test('extracts an exact publisher URL from framed RPC data, not arbitrary page links', () => {
  const url = 'https://example.com/news/story?id=123&lang=ko';
  const payload = JSON.stringify([['wrb.fr', 'Fbv4je', JSON.stringify(['garturlres', url]), null, '0']]);
  assert.equal(parsePublisherResponse(`)]}'\n\n${payload.length}\n${payload}\n`), url);
  assert.throws(() => parsePublisherResponse('<a href="https://example.com">advertisement</a>'));
  assert.throws(() => parsePublisherResponse(JSON.stringify([['wrb.fr', 'Fbv4je', JSON.stringify(['garturlres', 'javascript:alert(1)'])]])));
});
