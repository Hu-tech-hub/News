import { parse, type DefaultTreeAdapterTypes as Html } from 'parse5';

const ignoredTags = new Set(['script', 'style', 'noscript', 'template', 'iframe', 'svg', 'nav', 'aside', 'footer', 'form', 'button']);
const blockTags = new Set(['article', 'section', 'main', 'div', 'p', 'br', 'li', 'blockquote', 'tr', 'h1', 'h2', 'h3', 'h4', 'figcaption']);
const excludedRoles = new Set(['navigation', 'banner', 'complementary', 'contentinfo', 'menu']);
const contentName = /(?:^|\s)(?:article|story|post|entry)[-_](?:view[-_]content(?:[-_]div)?|body|content|text)(?:\s|$)/i;
const chromeName = /(?:^|[\s_-])(?:gnb|navbar|navigation|sidebar|related|recommendations|comments|advertisement|breadcrumb|social-share)(?:[\s_-]|$)/i;

export function extractArticleText(html: string): { title: string; text: string } {
  let title = '';
  let metaTitle = '';
  const candidates: { text: string; score: number }[] = [];
  const normalize = (text: string) => text.split('\n').map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');

  function visit(node: Html.Node, depth = 0): { text: string; links: number; prose: number } {
    if (node.nodeName === '#text' && 'value' in node) return { text: node.value, links: 0, prose: 0 };
    if (!('childNodes' in node) || depth > 128) return { text: '', links: 0, prose: 0 };

    const tag = 'tagName' in node ? node.tagName : '';
    const attributes = 'attrs' in node ? new Map(node.attrs.map(({ name, value }) => [name, value])) : new Map<string, string>();
    const role = attributes.get('role') || '';
    const names = [attributes.get('id'), attributes.get('class')].join(' ');
    const marked = attributes.get('itemprop')?.split(/\s+/).includes('articleBody');
    if (tag === 'meta' && attributes.get('property') === 'og:title') metaTitle ||= attributes.get('content') || '';
    if (ignoredTags.has(tag) || excludedRoles.has(role) || attributes.has('hidden') || attributes.get('aria-hidden') === 'true' || (!marked && chromeName.test(names))) {
      return { text: '', links: 0, prose: 0 };
    }

    const children = node.childNodes.map((child) => visit(child, depth + 1));
    const raw = children.map((child) => child.text).join('');
    if (tag === 'title') title ||= normalize(raw);
    if (tag === 'head') return { text: '', links: 0, prose: 0 };
    const links = tag === 'a' ? normalize(raw).length : children.reduce((sum, child) => sum + child.links, 0);
    const prose = tag === 'p' || tag === 'blockquote'
      ? Math.max(0, normalize(raw).length - links)
      : children.reduce((sum, child) => sum + child.prose, 0);

    const named = contentName.test(names);
    if (marked || named || tag === 'article' || tag === 'main' || tag === 'body' || role === 'main') {
      const text = normalize(raw);
      const linkRatio = links / Math.max(text.length, 1);
      if (text.length >= 100 && linkRatio < 0.45 && (tag !== 'body' || prose >= 100)) {
        const priority = marked ? 4 : named ? 3 : tag === 'article' ? 2 : tag === 'body' ? 0 : 1;
        const quality = Math.min(prose, 10_000) + Math.min(text.length, 10_000) / 4;
        candidates.push({ text, score: priority * 20_000 + quality * (1 - linkRatio) });
      }
    }
    return { text: blockTags.has(tag) ? '\n' + raw + '\n' : raw, links, prose };
  }

  visit(parse(html));
  candidates.sort((a, b) => b.score - a.score);
  return { title: metaTitle.trim() || title, text: candidates[0]?.text || '' };
}
