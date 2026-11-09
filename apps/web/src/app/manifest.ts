import type { MetadataRoute } from 'next';

/** Lets phones "Add to Home Screen" so the web app opens full-screen like a native one. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BarakahFi',
    short_name: 'BarakahFi',
    description:
      'Sharia-compliant personal finance: portfolio, halal screening, zakat and budgets.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#047857',
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
