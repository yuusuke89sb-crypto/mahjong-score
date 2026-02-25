const CACHE_NAME = 'mahjong-calc-v11';
const urlsToCache = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './scoreTable.js',
    './rules.js',
    './calculator.js',
    './tenbou.html',
    './tenbou.js',
    './tenbou.css',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

// インストール時にキャッシュ（即座にアクティベート）
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache:', CACHE_NAME);
                return cache.addAll(urlsToCache);
            })
    );
});

// ネットワーク優先戦略（JS/CSS/HTMLはネットワークから取得を試みる）
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    const isCodeFile = url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.html');

    if (isCodeFile) {
        // Network-first for code files
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
    } else {
        // Cache-first for assets (images, manifest)
        event.respondWith(
            caches.match(event.request)
                .then(response => response || fetch(event.request))
        );
    }
});

// 古いキャッシュを削除
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});
