import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { KEYS, readJSON, writeJSON } from './storage';

export const ROUTES = ['overview', 'quality', 'scores', 'todos', 'framework', 'data'] as const;
export type Route = (typeof ROUTES)[number];

/** 兼容 #overview 与 #/overview 两种写法 */
const parseHash = (): Route => {
  const id = window.location.hash.replace(/^#\/?/, '');
  return (ROUTES as readonly string[]).includes(id) ? (id as Route) : 'overview';
};

/**
 * 轻量路由：页面状态为准，hash 只用于深链接与浏览器前进后退。
 * 在禁止修改地址的嵌入环境（如 Artifact 预览）中同样可用。
 */
export function useRouter() {
  const [route, setRoute] = useState<Route>(parseHash);

  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((next: Route) => {
    setRoute(next);
    window.scrollTo({ top: 0 });
    try {
      if (window.location.hash !== `#${next}`) window.location.hash = next;
    } catch {
      // 地址不可写时只切换页面状态
    }
  }, []);

  return { route, navigate };
}

const RouterContext = createContext<(route: Route) => void>(() => {});

export const RouterProvider = RouterContext.Provider;

export function RouteLink({
  to,
  className,
  current,
  children,
}: {
  to: Route;
  className?: string;
  current?: boolean;
  children: ReactNode;
}) {
  const navigate = useContext(RouterContext);
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    navigate(to);
  };
  return (
    <a href={`#${to}`} className={className} aria-current={current ? 'page' : undefined} onClick={onClick}>
      {children}
    </a>
  );
}

type Theme = 'light' | 'dark';

const systemTheme = (): Theme => (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
const rootTheme = (): Theme | null => {
  const t = document.documentElement.dataset.theme;
  return t === 'light' || t === 'dark' ? t : null;
};

/**
 * 主题：根节点 data-theme 优先（手动切换或宿主页面设置），否则跟随系统。
 * 只在用户手动切换时写入 data-theme，不清除宿主设置的值。
 */
export function useTheme() {
  const [attr, setAttr] = useState<Theme | null>(() => {
    const saved = readJSON<Theme | null>(KEYS.theme, null);
    if (saved) document.documentElement.dataset.theme = saved;
    return rootTheme();
  });
  const [system, setSystem] = useState<Theme>(systemTheme);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const onChange = () => setSystem(mq.matches ? 'dark' : 'light');
    mq?.addEventListener('change', onChange);
    const observer = new MutationObserver(() => setAttr(rootTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      mq?.removeEventListener('change', onChange);
      observer.disconnect();
    };
  }, []);

  const theme = attr ?? system;
  const toggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    writeJSON(KEYS.theme, next);
  }, [theme]);

  return { theme, toggle };
}
