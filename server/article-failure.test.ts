import { test } from 'node:test';
import assert from 'node:assert/strict';
import dns from 'node:dns/promises';
import { runJobNewsADKWorkflow } from './adk-workflow.js';

test('403 after resolving Google News retains the publisher URL in the failed workflow', async (t) => {
  t.mock.method(dns, 'lookup', async () => ({ address: '93.184.216.34', family: 4 }));
  const publisherUrl = 'https://publisher.example/news/blocked';
  t.mock.method(globalThis, 'fetch', async (input: string | URL) => {
    const url = String(input);
    if (url.includes('/rss/articles/')) return new Response('<div data-n-a-sg="signature" data-n-a-ts="123"></div>');
    if (url.includes('/batchexecute')) return new Response(JSON.stringify([
      ['wrb.fr', 'Fbv4je', JSON.stringify(['garturlres', publisherUrl])],
    ]));
    assert.equal(url, publisherUrl);
    return new Response('Forbidden', { status: 403 });
  });
  const result = await runJobNewsADKWorkflow({
    articleTitle: '접근 제한 기사', sourceUrl: 'https://news.google.com/rss/articles/CBMi_test',
    targetCompany: '예시기업', targetRole: '품질관리', industryTags: [], inputType: 'search',
  });
  assert.equal(result.success, false);
  assert.equal(result.contentStatus, 'fetch_failed_needs_text');
  assert.match(result.errorMessage || '', /403/);
  assert.equal(result.sources[0].url, publisherUrl);
  assert.equal(result.sources[0].verificationStatus, 'fetch_error');
  assert.ok(!result.analysis);
});
