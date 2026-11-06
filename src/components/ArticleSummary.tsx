import type { ArticleOverview, SummaryFactItem } from '../types';

function Evidence({ item }: { item: SummaryFactItem }) {
  if (!item.quoteSnippet) return null;
  return (
    <details className="mt-3 rounded-lg border border-slate-700/70 bg-slate-950/40 px-3 py-2 text-xs">
      <summary className="cursor-pointer text-blue-300">원문 근거 · {item.sourceId}</summary>
      <blockquote className="mt-2 border-l-2 border-blue-500/40 pl-3 leading-relaxed text-slate-300">
        {item.quoteSnippet}
      </blockquote>
    </details>
  );
}

function Status({ item }: { item: SummaryFactItem }) {
  if (!item.status) return null;
  return (
    <span className="inline-block rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-300">
      {item.status}
    </span>
  );
}

export function ArticleSummary({ overview, items }: { overview?: ArticleOverview; items: SummaryFactItem[] }) {
  const metrics = items.filter((item) => item.layout === 'metric' && item.value);
  const timeline = items.filter((item) => item.layout === 'timeline' && item.value);
  const rows = items.filter((item) => item.layout === 'table');
  const cards = items.filter((item) => !metrics.includes(item) && !timeline.includes(item) && !rows.includes(item));

  return (
    <section className="space-y-5 rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-7" aria-label="기사에서 확인한 사실">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-bold text-white">기사에서 확인한 사실</p>
        {overview?.type && <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-medium text-blue-200">{overview.type}</span>}
      </div>
      {overview?.takeaway && (
        <div className="rounded-2xl border border-blue-500/25 bg-blue-950/40 p-5">
          <p className="text-lg font-semibold leading-relaxed text-white">{overview.takeaway}</p>
          {overview.context && <p className="mt-2 text-sm leading-relaxed text-slate-300">{overview.context}</p>}
        </div>
      )}
      {cards.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {cards.map((item, index) => (
            <article key={index} className="rounded-2xl border border-slate-800 bg-slate-800/40 p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {item.label && <h3 className="font-semibold text-white">{item.label}</h3>}
                <Status item={item} />
              </div>
              <p className="text-sm leading-relaxed text-slate-200">{item.factText}</p>
              <Evidence item={item} />
            </article>
          ))}
        </div>
      )}
      {metrics.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white">핵심 수치</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {metrics.map((item, index) => (
              <article key={index} className="rounded-2xl border border-cyan-500/20 bg-cyan-950/25 p-4">
                <h4 className="text-sm font-medium text-slate-200">{item.label || '기사 지표'}</h4>
                <p className="my-2 text-2xl font-bold text-cyan-200">{item.value}</p>
                <Status item={item} />
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{item.factText}</p>
                <Evidence item={item} />
              </article>
            ))}
          </div>
        </div>
      )}
      {timeline.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white">주요 경과</h3>
          <ol className="space-y-4 border-l-2 border-blue-500/40 pl-4">
            {timeline.map((item, index) => (
              <li key={index}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-blue-200">{item.value}</span>
                  <span className="text-sm font-medium text-white">{item.label}</span>
                  <Status item={item} />
                </div>
                <p className="mt-1 text-sm leading-relaxed text-slate-300">{item.factText}</p>
                <Evidence item={item} />
              </li>
            ))}
          </ol>
        </div>
      )}
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-sm text-slate-200">
            <thead className="bg-slate-800/70">
              <tr><th scope="col" className="p-3">항목</th><th scope="col" className="p-3">기사에서 확인한 내용</th></tr>
            </thead>
            <tbody>
              {rows.map((item, index) => (
                <tr key={index} className="border-t border-slate-800 align-top">
                  <th scope="row" className="w-1/4 p-3 font-medium text-white">{item.label || '기사 내용'}</th>
                  <td className="p-3 leading-relaxed">
                    <Status item={item} />
                    <p>{item.factText}</p>
                    <Evidence item={item} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
