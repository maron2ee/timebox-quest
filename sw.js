/* TIMEBOX QUEST service worker — offline app shell + CDN font caching */
const CACHE = "tbq-v22";
const SHELL = [
  "./", "./index.html", "./css/theme.css",
  "./js/state.js", "./js/charts.js", "./js/gamify.js", "./js/character.js",
  "./js/planner.js", "./js/todos.js", "./js/journal.js", "./js/pomodoro.js", "./js/analytics.js", "./js/calendar.js", "./js/habits.js", "./js/sync.js", "./js/app.js",
  "./manifest.webmanifest", "./icon.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Supabase API: always network (never cache user data / auth)
  if (url.hostname.endsWith("supabase.co")) return;

  if (url.origin === location.origin) {
    // app shell: NETWORK-FIRST so code updates apply immediately; cache is the
    // offline fallback. (cache-first left users stuck on stale JS after deploys.)
    e.respondWith(
      fetch(req).then((resp) => {
        const cp = resp.clone();
        caches.open(CACHE).then((c) => c.put(req, cp));
        return resp;
      }).catch(() =>
        caches.match(req).then((hit) => hit || (req.mode === "navigate" ? caches.match("./index.html") : undefined))
      )
    );
  } else {
    // CDN (fonts / supabase-js): stale-while-revalidate
    e.respondWith(
      caches.match(req).then((hit) => {
        const net = fetch(req).then((resp) => {
          const cp = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, cp));
          return resp;
        }).catch(() => hit);
        return hit || net;
      })
    );
  }
});
