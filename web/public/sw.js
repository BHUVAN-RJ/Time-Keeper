const CACHE = "time-keeper-v1";
const ASSETS = ["/manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener("fetch", (e) => {
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request));
    return;
  }
  const url = new URL(e.request.url);
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request)),
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request)),
  );
});
