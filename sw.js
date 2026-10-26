/* 하루 계획 — 서비스워커 (network-first: 배포 직후 최신 코드가 바로 반영되게) */
const CACHE = "plan-v3";
const ASSETS = [
  "./", "./index.html", "./css/app.css", "./manifest.webmanifest", "./icon.svg",
  "./js/util.js", "./js/store.js", "./js/market.js", "./js/ui.js",
  "./js/timeline.js", "./js/routine.js", "./js/hypothesis.js", "./js/trades.js", "./js/judge.js",
  "./js/tasks.js", "./js/pomodoro.js", "./js/day.js",
  "./js/stats.js", "./js/archive.js", "./js/terms.js", "./js/research.js",
  "./js/settings.js", "./js/app.js",
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match("./index.html")))
  );
});
