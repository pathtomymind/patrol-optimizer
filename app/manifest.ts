import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '길도사 정비반',
    short_name: '길도사',
    description: '불법 옥외광고물 순회 단속 경로 최적화',
    start_url: '/',
    display: 'standalone',
    background_color: '#0d2444',
    theme_color: '#1a3a6e',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon-192.png?v=2',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png?v=2',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icon-512.png?v=2',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}