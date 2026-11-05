import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';
import React, { act } from 'react';

test('analysis navigation preserves search results, page and scroll without searching again', async (t) => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  for (const key of ['window', 'document', 'HTMLElement', 'Event', 'MouseEvent']) Object.defineProperty(globalThis, key, { configurable: true, value: (dom.window as any)[key] });
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(dom.window, 'indexedDB', { value: new IDBFactory() });
  Object.defineProperty(dom.window, 'scrollY', { configurable: true, writable: true, value: 0 });
  dom.window.scrollTo = ((options: ScrollToOptions) => { (dom.window as any).scrollY = options.top || 0; }) as any;
  const { saveTarget, setActiveTargetId } = await import('./services/db.js');
  await saveTarget({ id: 'a', companyName: '기업', jobRole: '설계', industryTags: [], createdAt: 1, updatedAt: 1 }); await setActiveTargetId('a');
  const articles = Array.from({ length: 23 }, (_, i) => ({ id: String(i), title: `기사${i + 1}`, sourceUrl: `https://example.com/${i + 1}`, publisher: '뉴스', publishedAt: '2026-11-05', publishedDatePrecision: 'date', relationType: 'company_direct', selectionReason: '기업 관련' }));
  let searches = 0;
  const analyzed: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string, options?: RequestInit) => {
    if (url === '/api/system-status') return Response.json({ geminiConfigured: true, model: 'test' });
    if (url === '/api/search-news') { searches++; return Response.json({ articles, searchTimeKST: '검색 시각', timeframe: 'last_7_days', queryUsed: '기업', excludedCountMissingDate: 0, excludedCountOutOfRange: 0 }); }
    assert.equal(url, '/api/analyze-article');
    const body = JSON.parse(String(options?.body)); analyzed.push(body.sourceUrl);
    return Response.json({ success: true, articleTitle: body.articleTitle, articleText: '검증용 본문 '.repeat(20), sources: [{ sourceId: 'src-1', url: body.sourceUrl }], contentStatus: 'full_text_fetched',
      analysis: { targetSnapshot: { companyName: '기업', jobRole: '설계', industryTags: [] }, industryTags: [], companyTags: [], issueTags: [], summaryItems: [], implications: [], interviewQuestions: [], uncertainties: [], analyzedAt: new Date().toISOString() } });
  });
  const { createRoot } = await import('react-dom/client'); const { default: App } = await import('./App.js');
  const root = createRoot(document.getElementById('root')!);
  const settle = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 40)); }); };
  const click = async (text: string, last = false) => {
    const buttons = [...document.querySelectorAll('button')].filter((button) => button.textContent?.trim() === text);
    const button = last ? buttons.at(-1) : buttons[0]; assert.ok(button, text);
    await act(async () => { button.click(); }); await settle();
  };
  try {
    await act(async () => { root.render(<App />); }); await settle();
    await click('뉴스 찾기', true); await click('다음'); await click('다음');
    (dom.window as any).scrollY = 950;
    await click('분석하기');
    assert.equal(analyzed[0], 'https://example.com/21');
    assert.equal(dom.window.location.hash, '#analysis');
    await click('다음 기사'); assert.equal(analyzed[1], 'https://example.com/22');
    await act(async () => { dom.window.history.back(); await new Promise((resolve) => setTimeout(resolve, 50)); }); await settle();
    assert.equal(dom.window.location.hash, '#search');
    assert.equal(dom.window.scrollY, 950);
    assert.equal(document.querySelector('button[aria-current="page"]')?.textContent, '3');
    assert.equal(document.querySelector('main > div')?.hasAttribute('hidden'), false);
    assert.match(document.querySelector('main > div')?.textContent || '', /분석 완료/);
    assert.equal(searches, 1);
    await click('분석하기'); await click('← 검색 결과로');
    assert.equal(dom.window.scrollY, 950);
    assert.equal(searches, 1);
  } finally { await act(async () => { root.unmount(); }); dom.window.close(); }
});
