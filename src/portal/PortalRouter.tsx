import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface PortalRouterContextValue {
  path: string;
  query: URLSearchParams;
  navigate: (to: string, options?: { replace?: boolean }) => void;
  exitToPublicSite: () => void;
}

const PortalRouterContext = createContext<PortalRouterContextValue | null>(null);

export function getCurrentPortalLocation(): { pathname: string; search: string } {
  if (typeof window === 'undefined') return { pathname: '/', search: '' };
  // Support hash fallback (#/portal/..., #/admin/..., #/legal/...) for static GitHub Pages deployments
  const hash = window.location.hash || '';
  if (hash.startsWith('#/portal') || hash.startsWith('#/admin') || hash.startsWith('#/legal')) {
    const clean = hash.slice(1);
    const [p, s = ''] = clean.split('?');
    return { pathname: p, search: s ? `?${s}` : '' };
  }
  return { pathname: window.location.pathname, search: window.location.search };
}

export function isPortalRoute(pathname?: string): boolean {
  const target = pathname ?? getCurrentPortalLocation().pathname;
  return target === '/portal' || target.startsWith('/portal/');
}

export function isAdminRoute(pathname?: string): boolean {
  const target = pathname ?? getCurrentPortalLocation().pathname;
  return target === '/admin' || target.startsWith('/admin/');
}

export function isLegalRoute(pathname?: string): boolean {
  const target = pathname ?? getCurrentPortalLocation().pathname;
  return target === '/legal' || target.startsWith('/legal/');
}

export function navigateToAppPath(to: string, replace = false) {
  if (typeof window === 'undefined') return;
  const cleanTarget = to.startsWith('/') ? to : `/${to}`;
  const isStaticPagesHost =
    window.location.hostname.endsWith('github.io') ||
    (window.location.pathname.includes('/OMPNETWORK/') && !cleanTarget.startsWith('/OMPNETWORK'));

  const isSpaSubApp =
    cleanTarget.startsWith('/portal') ||
    cleanTarget.startsWith('/admin') ||
    cleanTarget.startsWith('/legal');

  if (isStaticPagesHost && isSpaSubApp) {
    const nextHash = `#${cleanTarget}`;
    if (replace) window.history.replaceState(null, '', nextHash);
    else window.history.pushState(null, '', nextHash);
  } else if (cleanTarget === '/' && (window.location.hash.startsWith('#/portal') || window.location.hash.startsWith('#/admin') || window.location.hash.startsWith('#/legal'))) {
    if (replace) window.history.replaceState(null, '', window.location.pathname);
    else window.history.pushState(null, '', window.location.pathname);
  } else {
    if (replace) window.history.replaceState(null, '', cleanTarget);
    else window.history.pushState(null, '', cleanTarget);
  }
  window.dispatchEvent(new Event('opm:routechange'));
  window.scrollTo({ top: 0, behavior: 'auto' });
}

export function navigateToPortalPath(to: string, replace = false) {
  navigateToAppPath(to, replace);
}

export const PortalRouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loc, setLoc] = useState(getCurrentPortalLocation);

  useEffect(() => {
    const sync = () => setLoc(getCurrentPortalLocation());
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    window.addEventListener('opm:routechange', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('opm:routechange', sync);
    };
  }, []);

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    navigateToAppPath(to, Boolean(options?.replace));
  }, []);

  const exitToPublicSite = useCallback(() => {
    navigateToAppPath('/');
  }, []);

  return (
    <PortalRouterContext.Provider
      value={{
        path: loc.pathname,
        query: new URLSearchParams(loc.search),
        navigate,
        exitToPublicSite,
      }}
    >
      {children}
    </PortalRouterContext.Provider>
  );
};

export function usePortalRouter(): PortalRouterContextValue {
  const ctx = useContext(PortalRouterContext);
  if (!ctx) {
    throw new Error('usePortalRouter must be used inside PortalRouterProvider');
  }
  return ctx;
}
