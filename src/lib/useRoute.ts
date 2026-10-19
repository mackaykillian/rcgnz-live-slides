import { useCallback, useEffect, useState } from 'react';
import { isTemplateId, type TemplateId } from '../slides/templates';

/**
 * Hash routes so views are linkable:
 *   #/slides, #/slides/standard
 *   #/slideshow, #/slideshow/grand-ballroom, #/slideshow/grand-ballroom/<entry key>
 *   #/calendar, #/calendar/2026-11-10
 */
export type Route =
  | { section: 'slides'; template: TemplateId | null }
  | { section: 'slideshow'; deck: string | null; slide: string | null }
  | { section: 'calendar'; day: string | null };

export function parseRoute(hash: string): Route {
  const [section, deck, ...rest] = hash.replace(/^#\/?/, '').split('/');
  if (section === 'calendar') return { section, day: deck && /^\d{4}-\d{2}-\d{2}$/.test(deck) ? deck : null };
  if (section === 'slideshow') {
    const slide = rest.join('/');
    return { section, deck: deck ? decodeURIComponent(deck) : null, slide: slide ? decodeURIComponent(slide) : null };
  }
  return { section: 'slides', template: isTemplateId(deck) ? deck : null };
}

export function routeHref(route: Route): string {
  if (route.section === 'calendar') return route.day ? `#/calendar/${route.day}` : '#/calendar';
  if (route.section === 'slideshow') {
    if (!route.deck) return '#/slideshow';
    const base = `#/slideshow/${encodeURIComponent(route.deck)}`;
    return route.slide ? `${base}/${encodeURIComponent(route.slide)}` : base;
  }
  return route.template ? `#/slides/${route.template}` : '#/slides';
}

/** `replace` swaps the current history entry (used when stepping through slides). */
export function useRoute(): [Route, (route: Route, options?: { replace?: boolean }) => void] {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));

  useEffect(() => {
    const onHash = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = useCallback((next: Route, { replace = false } = {}) => {
    const href = routeHref(next);
    if (replace) {
      history.replaceState(null, '', href);
      setRoute(parseRoute(href));
    } else {
      window.location.hash = href;
    }
  }, []);

  return [route, navigate];
}
