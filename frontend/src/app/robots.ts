import type { MetadataRoute } from 'next';
import { SITE_URL, getPrivatePathPrefixes } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: getPrivatePathPrefixes(),
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
