const CACHE_NAME = 'exercise-calendar-v18'
const urlsToCache = [
  '/',
  '/index.html',
  '/app.js',
  '/style.css',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://unpkg.com/vue@3/dist/vue.global.js',
  '/stamps/cat_red.svg',
  '/stamps/cat_pink.svg',
  '/stamps/cat_white.svg',
  '/stamps/cat_black.svg'
]

// インストール時に静的アセットをキャッシュ（Cache-First用）
self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 Service Worker: 静的アセットをキャッシュしています...')
      return cache.addAll(urlsToCache)
    })
  )
})

// リクエスト時のハンドリング
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // APIリクエストはNetwork-First（1秒でタイムアウトしオフラインフォールバックJSONを返却）
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      (async () => {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 1000)
        try {
          const response = await fetch(event.request, {
            signal: controller.signal
          })
          clearTimeout(timeoutId)
          return response
        } catch (error) {
          clearTimeout(timeoutId)
          console.log(
            `🔌 Service Worker: オフラインまたはタイムアウトのためAPIをフォールバック [${url.pathname}]`,
            error.message
          )
          return new Response(
            JSON.stringify({
              success: false,
              offline: true,
              status: 'offline',
              error: 'オフラインのためローカルモードで動作中'
            }),
            {
              status: 503,
              statusText: 'Service Unavailable (Offline)',
              headers: { 'Content-Type': 'application/json; charset=utf-8' }
            }
          )
        }
      })()
    )
    return
  }

  // 静的アセットはCache-First（キャッシュ優先、なければネットワーク取得してキャッシュ保存）
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse
      }

      return fetch(event.request)
        .then((networkResponse) => {
          // 正常なGETレスポンスならキャッシュに保存
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            event.request.method === 'GET'
          ) {
            const responseClone = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone)
            })
          }
          return networkResponse
        })
        .catch(() => {
          // ナビゲーションリクエスト（画面リロード等）の場合はindex.htmlを返す
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html')
          }
          return null
        })
    })
  )
})

// 古いキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('🗑️ Service Worker: 古いキャッシュを削除:', cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      })
      .then(() => self.clients.claim())
  )
})
