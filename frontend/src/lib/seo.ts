import fs from 'fs';
import path from 'path';

export const SITE_URL = 'https://inboxcrm.uz';
const APP_DIR = path.join(process.cwd(), 'src', 'app');
const PRIVATE_ROUTE_GROUPS = new Set(['(dashboard)']);
const PRIVATE_ROOT_SEGMENTS = new Set(['login']);

export type SeoRoute = {
  url: string;
  lastModified: Date;
  changeFrequency: 'yearly' | 'monthly' | 'weekly';
  priority: number;
};

type ScannedRoute = {
  route: string;
  segments: string[];
  sourceFile: string;
};

function isRouteGroup(segment: string): boolean {
  return segment.startsWith('(') && segment.endsWith(')');
}

function toRoutePath(segments: string[]): string {
  const routeSegments = segments.filter((segment) => !isRouteGroup(segment));
  return routeSegments.length === 0 ? '/' : `/${routeSegments.join('/')}`;
}

function isPublicScannedRoute(route: ScannedRoute): boolean {
  if (route.segments.some((segment) => PRIVATE_ROUTE_GROUPS.has(segment))) {
    return false;
  }

  const firstSegment = route.segments.find((segment) => !isRouteGroup(segment));
  if (firstSegment && PRIVATE_ROOT_SEGMENTS.has(firstSegment)) {
    return false;
  }

  return true;
}

function scanAppDirectory(currentDir: string, segments: string[] = []): ScannedRoute[] {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  const results: ScannedRoute[] = [];

  for (const entry of entries) {
    const nextPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      results.push(...scanAppDirectory(nextPath, [...segments, entry.name]));
      continue;
    }

    if (entry.isFile() && entry.name === 'page.tsx') {
      const route = toRoutePath(segments);
      results.push({
        route,
        segments,
        sourceFile: nextPath,
      });
    }
  }

  return results;
}

export function getPublicSeoRoutes(): SeoRoute[] {
  const routes = scanAppDirectory(APP_DIR)
    .filter(isPublicScannedRoute)
    .map((route) => {
      const fileStats = fs.statSync(route.sourceFile);
      const normalizedRoute = route.route
        .replace(/\/\[[^/]+\](?=\/|$)/g, '/')
        .replace(/\/{2,}/g, '/')
        .replace(/\/$/, '') || '/';

      const priority = normalizedRoute === '/' ? 1 : normalizedRoute === '/privacy' || normalizedRoute === '/terms' ? 0.3 : 0.6;
      const changeFrequency = normalizedRoute === '/' ? 'weekly' : 'yearly';

      return {
        url: `${SITE_URL}${normalizedRoute === '/' ? '' : normalizedRoute}`,
        lastModified: fileStats.mtime,
        changeFrequency,
        priority,
      } satisfies SeoRoute;
    });

  return routes.sort((a, b) => {
    if (a.url === `${SITE_URL}`) return -1;
    if (b.url === `${SITE_URL}`) return 1;
    return a.url.localeCompare(b.url);
  });
}

export function getPrivatePathPrefixes(): string[] {
  return [
    '/login',
    '/inbox',
    '/leads',
    '/calls',
    '/stats',
    '/instagram',
    '/ai-assistant',
    '/settings',
  ];
}
