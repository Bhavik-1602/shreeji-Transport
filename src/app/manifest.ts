import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Shreeji Transport ERP',
    short_name: 'Shreeji ERP',
    description: 'Trip and accounting system for Shreeji Transport.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#F1F4F3',
    theme_color: '#F97316',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
