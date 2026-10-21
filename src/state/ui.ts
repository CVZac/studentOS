import { useCallback, useEffect, useState } from 'react';
import { KEYS, readJSON, writeJSON } from './storage';

export const ROUTES = ['overview', 'quality', 'scores', 'todos', 'framework', 'data'] as const;
export type Route = (typeof ROUTES)[number];

const parseHash = (): Route => {
  const id = window.location.hash.replace(/^#\/?/, '');
  return (ROUTES as readonly string[]).includes(id) ? (id as Route) : 'overview';
};

/** 基于 hash 的轻量路由，便于静态托管 */
export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(parseHash);
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

type Theme = 'light' | 'dark';

const systemTheme = (): Theme => (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

/** 未手动选择时跟随系统；手动切换后记住选择 */
export function useTheme() {
  const [explicit, setExplicit] = useState<Theme | null>(() => readJSON<Theme | null>(KEYS.theme, null));
  const [system, setSystem] = useState<Theme>(systemTheme);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = () => setSystem(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (explicit) document.documentElement.dataset.theme = explicit;
    else delete document.documentElement.dataset.theme;
  }, [explicit]);

  const theme = explicit ?? system;
  const toggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setExplicit(next);
    writeJSON(KEYS.theme, next);
  }, [theme]);

  return { theme, toggle };
}
