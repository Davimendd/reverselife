// ============================================================
// REVERSE LIFE — service worker
// Cacheia o "app shell" (HTML/CSS/JS estáticos) pra abrir mais
// rápido e funcionar minimamente offline. NUNCA intercepta
// chamadas de outra origem (Firebase, fontes do Google etc.) —
// essas sempre vão direto pra rede, pra não quebrar login,
// rolagens em tempo real ou dados das campanhas.
//
// Ao publicar uma nova versão do site, aumente o número em
// CACHE_NAME (ex: "reverse-life-v2") pra forçar os navegadores
// a buscarem os arquivos atualizados em vez de usar o cache antigo.
// ============================================================

const CACHE_NAME = "reverse-life-v2";

const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./campaigns.js",
  "./identity.js",
  "./firebase-core.js",
  "./firebase-config.js",
  "./sound.js",
  "./pwa.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch((err) => console.error("Falha ao pré-cachear o app shell:", err))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // só cuida de requisições GET da própria origem do site — tudo
  // que for pro Firebase/Firestore/Auth ou fontes do Google passa direto
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);

      // serve do cache na hora (se existir) e atualiza em segundo plano;
      // sem cache, espera a rede
      return cached || networkFetch;
    })
  );
});
