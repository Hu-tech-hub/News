import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';

test('pages through all results, analyzes the selected page article, and resets after a search', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  for (const key of ['window', 'document', 'HTMLElement', 'Event', 'MouseEvent']) Object.defineProperty(globalThis, key, { configurable: true, value: (dom.window as any)[key] });
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { SearchNewsView } = await import('./SearchNewsView.js');
  const root = createRoot(document.getElementById('root')!);
  const articles = Array.from({ length: 23 }, (_, i) => ({ id: String(i), title: `기사-${i + 1}`, publisher: '뉴스', sourceUrl: `https://example.com/${i + 1}`, publishedAt: '2026-11-05', publishedDatePrecision: 'date' as const, relationType: 'company_direct' as const, selectionReason: '기업 관련' }));
  let selected: any;
  const click = async (label: string) => {
    const button = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === label);
    assert.ok(button, label); await act(async () => { button.click(); });
  };
  try {
    await act(async () => { root.render(<SearchNewsView activeTarget={{ id: 'target', companyName: '기업', jobRole: '설계', industryTags: [], createdAt: 1, updatedAt: 1 }}
      onOpenTargetManager={() => {}} bookmarkedUrls={new Set()} onAnalyzeArticle={(params) => { selected = params; }}
      onPerformSearch={async (params) => ({ articles, searchTimeKST: '검색 시각', timeframe: params.timeframe, queryUsed: params.companyName, targetCompany: params.companyName, targetRole: params.jobRole, excludedCountMissingDate: 0, excludedCountOutOfRange: 0, totalFoundRaw: 23, isGroundingLive: false })} />); });
    await click('뉴스 찾기');
    assert.equal(document.querySelectorAll('button[aria-current="page"]').length, 2);
    assert.ok(document.querySelector('a[href="https://example.com/1"]'));
    assert.ok(!document.querySelector('a[href="https://example.com/11"]'));
    await click('다음'); await click('다음');
    assert.ok(document.querySelector('a[href="https://example.com/23"]'));
    assert.ok(!document.querySelector('a[href="https://example.com/20"]'));
    assert.ok([...document.querySelectorAll('button')].filter((b) => b.textContent === '다음').every((b) => b.disabled));
    await click('분석하기');
    assert.equal(selected.sourceUrl, 'https://example.com/21');
    await click('뉴스 찾기');
    assert.ok(document.querySelector('a[href="https://example.com/1"]'));
    assert.ok(!document.querySelector('a[href="https://example.com/21"]'));
  } finally { await act(async () => { root.unmount(); }); dom.window.close(); }
});
