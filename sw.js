// 앱 설치(홈 화면 전체화면 실행)를 위한 최소 서비스워커 — 캐시는 하지 않고 항상 최신 화면을 불러옴
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request));
});
