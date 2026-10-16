// ============================================================
// REVERSE LIFE — service worker
// Cacheia o "app shell" (HTML/CSS/JS estáticos) pra abrir mais
// rápido e funcionar minimamente offline. NUNCA intercepta
// chamadas de outra origem (Firebase, fontes do Google etc.) —
// essas sempre vão direto pra rede, pra não quebrar login,
// rolagens em tempo real ou dados das campanhas.
//
// Ao publicar uma nova versão do site, aumente o número em
// CACHE_NAME (ex: "reverse-life-v13") pra forçar os navegadores
// a buscarem os arquivos atualizados em vez de usar o cache antigo.
// ============================================================

const CACHE_NAME = "reverse-life-v12";

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
  "./rules.js",
  "./icons.js",
  "./dice-data.js",
  "./pwa.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL.map((u) => new Request(u, { cache: "reload" }))))
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

  // REDE PRIMEIRO: sempre busca a versão mais nova (sem usar o cache HTTP do
  // navegador) e guarda uma cópia. O cache só é usado quando está offline.
  // Isso evita misturar arquivos antigos e novos depois de uma atualização.
  event.respondWith(
    fetch(event.request, { cache: "no-cache" })
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) =>
          cached || (event.request.mode === "navigate" ? caches.match("./index.html") : Response.error())
        )
      )
  );
});

// clique em uma notificação: foca numa aba já aberta do site, ou abre uma nova
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("./index.html");
    })
  );
});
