import type { MetadataRoute } from 'next';
import { getPublicSeoRoutes } from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  return getPublicSeoRoutes();
}
