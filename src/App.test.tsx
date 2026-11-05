import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';
import React, { act } from 'react';

test('streamed stages, target changes, stale responses, and empty-body failures remain isolated', async (t) => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'Event', 'MouseEvent']) {
    Object.defineProperty(globalThis, key, { configurable: true, value: (dom.window as any)[key] });
  }
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.scrollTo = () => {};
  Object.defineProperty(dom.window, 'indexedDB', { value: new IDBFactory() });
  const { saveTarget, setActiveTargetId } = await import('./services/db.js');
  const a = { id: 'a', companyName: '현대자동차', jobRole: '품질관리', industryTags: [], createdAt: 1, updatedAt: 1 };
  const b = { ...a, id: 'b', companyName: '대양전기공업', jobRole: '설계', createdAt: 2 };
  await saveTarget(a); await saveTarget(b); await setActiveTargetId(a.id);
  const pending: Array<{ body: any; stream: ReadableStreamDefaultController<Uint8Array> }> = [];
  t.mock.method(globalThis, 'fetch', async (url: string, options?: RequestInit) => {
    if (url === '/api/system-status') return Response.json({ geminiConfigured: true, model: 'test' });
    assert.equal(url, '/api/analyze-article');
    const body = JSON.parse(String(options?.body));
    const stream = new ReadableStream<Uint8Array>({ start(controller) { pending.push({ body, stream: controller }); } });
    return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson' } });
  });
  const { createRoot } = await import('react-dom/client');
  const { default: App } = await import('./App.js');
  const root = createRoot(document.getElementById('root')!);
  const settle = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 40)); }); };
  const click = async (label: string, index = 0) => {
    const buttons = [...document.querySelectorAll('button')].filter((item) => item.textContent?.trim() === label);
    assert.ok(buttons[index], `button ${label} exists`);
    await act(async () => { buttons[index].click(); }); await settle();
  };
  const input = async (selector: string, value: string) => {
    const element = document.querySelector(selector) as HTMLInputElement;
    assert.ok(element, selector);
    const prototype = element.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
    await act(async () => {
      Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value);
      element.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
  };
  const emit = async (index: number, event: unknown, close = false) => {
    // Deliberately split inside the UTF-8 JSON event, as real streaming may do.
    const bytes = new TextEncoder().encode(JSON.stringify(event) + '\n');
    await act(async () => {
      pending[index].stream.enqueue(bytes.slice(0, 13)); pending[index].stream.enqueue(bytes.slice(13));
      if (close) pending[index].stream.close();
    }); await settle();
  };
  const result = (index: number, fact: string) => ({
    success: true, articleTitle: pending[index].body.articleTitle, articleText: '본문 근거 '.repeat(20), sources: [], contentStatus: 'user_provided_text',
    analysis: { targetSnapshot: { companyName: pending[index].body.targetCompany, jobRole: pending[index].body.targetRole, industryTags: [] },
      industryTags: [], companyTags: [], issueTags: [], summaryItems: [{ factText: fact, sourceId: 'src-1' }], implications: [], interviewQuestions: [], uncertainties: [], analyzedAt: new Date().toISOString() },
  });
  try {
    await act(async () => { root.render(<App />); }); await settle();
    await click('본문 직접 붙여넣기');
    await input('input[placeholder="기사 제목을 입력하세요"]', '검증 기사');
    await input('textarea', '검증용 기사 본문으로 개인정보나 실제 뉴스가 아닙니다. 기업이 새로운 설계를 검증하고 품질 기준을 확인한다는 테스트 내용입니다.');
    await act(async () => { document.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); }); await settle();
    assert.equal(pending[0].body.targetRole, '품질관리');
    await emit(0, { type: 'progress', stage: 'analyzing', elapsedMs: 250 });
    assert.match(document.body.textContent || '', /진행 중/);
    assert.match(document.body.textContent || '', /AI 요약/);
    await act(async () => { (document.querySelector('button[title="관심 대상 관리"]') as HTMLElement).click(); }); await settle();
    await click('분석 대상으로 선택');
    assert.equal(pending[1].body.targetCompany, '대양전기공업');
    assert.equal(pending[1].body.targetRole, '설계');
    await emit(1, { type: 'result', result: result(1, '새 설계 분석 사실') }, true);
    assert.match(document.body.textContent || '', /새 설계 분석 사실/);
    await emit(0, { type: 'result', result: result(0, '과거 현대차 사실') }, true);
    assert.doesNotMatch(document.body.textContent || '', /과거 현대차 사실/);
    await click('뉴스 찾기'); await click('기사 URL 직접 입력');
    await input('input[placeholder="https://..."]', 'https://example.com/new-story');
    await act(async () => { document.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); }); await settle();
    assert.doesNotMatch(document.body.textContent || '', /새 설계 분석 사실/);
    await emit(2, { type: 'result', result: { success: false, articleText: '', sources: [], contentStatus: 'fetch_failed_needs_text', errorMessage: '본문 수집 실패 테스트' } }, true);
    assert.match(document.body.textContent || '', /본문 수집 실패 테스트/);
    assert.doesNotMatch(document.body.textContent || '', /새 설계 분석 사실|과거 현대차 사실/);
    await act(async () => { (document.querySelector('button[title="관심 대상 관리"]') as HTMLElement).click(); }); await settle();
    await act(async () => { (document.querySelector('button[title="수정"]') as HTMLElement).click(); }); await settle();
    await input('input[placeholder="예: 반도체 공정설계, 배터리 개발, 백엔드"]', '전장 설계');
    await act(async () => { document.querySelector('.fixed form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); }); await settle();
    assert.equal(pending[3].body.targetRole, '전장 설계');
    await emit(3, { type: 'result', result: { ...result(3, '본문 없는 잘못된 사실'), articleText: '' } }, true);
    assert.match(document.body.textContent || '', /기사 본문 또는 분석 기준이 요청과 일치하지 않아/);
    assert.doesNotMatch(document.body.textContent || '', /본문 없는 잘못된 사실/);
  } finally { await act(async () => { root.unmount(); }); dom.window.close(); }
});
