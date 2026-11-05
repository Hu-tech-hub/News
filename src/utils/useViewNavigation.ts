import { useEffect, useLayoutEffect, useRef, useState } from 'react';

type View = 'search' | 'analysis' | 'bookmarks';

export function useViewNavigation() {
  const [view, setView] = useState<View>('search');
  const current = useRef<View>('search');
  const scroll = useRef<Record<View, number>>({ search: 0, analysis: 0, bookmarks: 0 });
  const navigate = (next: View, resetScroll = false) => {
    if (current.current === next) {
      if (resetScroll) window.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }
    scroll.current[current.current] = window.scrollY;
    if (resetScroll) scroll.current[next] = 0;
    current.current = next;
    window.history.pushState({ ...window.history.state, newsView: next }, '', `#${next}`);
    setView(next);
  };
  useEffect(() => {
    window.history.replaceState({ ...window.history.state, newsView: 'search' }, '', '#search');
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    const onPop = (event: PopStateEvent) => {
      const next = event.state?.newsView;
      if (!['search', 'analysis', 'bookmarks'].includes(next)) return;
      scroll.current[current.current] = window.scrollY;
      current.current = next;
      setView(next);
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.history.scrollRestoration = previousRestoration;
    };
  }, []);
  useLayoutEffect(() => { window.scrollTo({ top: scroll.current[view], behavior: 'instant' }); }, [view]);
  return [view, navigate] as const;
}
