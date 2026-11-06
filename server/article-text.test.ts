import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractArticleText } from './article-text.js';

const paragraph = 'The manufacturer published a new research report explaining how its engineers evaluated the reliability of the prototype under prolonged testing.';

test('prefers the marked body even when an article tag appears earlier', () => {
  const result = extractArticleText(`<title>Research &amp; development</title>
    <article><p>${paragraph} This is unrelated introductory text.</p></article>
    <section itemprop=articleBody><p>${paragraph}</p><div><p>Testing is ongoing.</p></div></section>`);
  assert.equal(result.title, 'Research & development');
  assert.equal(result.text, paragraph + '\nTesting is ongoing.');
});

test('picks prose from unmarked HTML and rejects navigation-only pages', () => {
  const menu = '<article>' + '<a href="/other">Link to another article in this edition</a>'.repeat(12) + '</article>';
  const result = extractArticleText(menu + `<main><article><p>${paragraph}</p>
    <aside>Popular stories</aside><script>unrelated script</script></article></main>`);
  assert.equal(result.text, paragraph);
  assert.equal(extractArticleText(menu).text, '');
});
