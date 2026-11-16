// 앱 설치(홈 화면 전체화면 실행)용 서비스워커
// 캐시를 쓰지 않고 매번 GitHub에서 최신 파일을 받아옴 → 파일을 올리면 다음 새로고침에 바로 반영
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request.url, { cache: 'no-store' }).catch(function () { return fetch(e.request); })
  );
});
