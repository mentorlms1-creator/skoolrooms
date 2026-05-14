import type { MetadataRoute } from 'next'
import { platformUrl } from '@/lib/platform/domain'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard/', '/admin/', '/student/', '/api/'],
    },
    sitemap: platformUrl('/sitemap.xml'),
  }
}
