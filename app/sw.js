// sw.js — Antecipa service worker
// Versão: antecipa-v1.0
// Estratégia: cache-first para assets estáticos, com fallback de rede.
// Bump da constante CACHE_NAME sempre que style.css/index.html ou
// qualquer módulo mudar — sem isso, utilizadores que já instalaram a PWA
// não veem a atualização.

const CACHE_NAME = "antecipa-v1.1";

const ASSETS_ESTATICOS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./data/legislacao-2026.js",
  "./data/i18n.js",
  "./engine/calculo-irs.js",
  "./engine/projecao.js",
  "./engine/quociente.js",
  "./parsers/pdf-text.js",
  "./parsers/parser-talao.js",
  "./parsers/parser-recibo-verde.js",
  "./storage/db.js",
  "./export/pdf-export.js",
  "./ui/onboarding.js",
  "./ui/ventanas-mensais.js",
  "./ui/ventana-13.js",
  "./ui/ventana-14.js",
  "./ui/components/symbol.js",
  "./ui/components/confirmacao.js",
  "../icons/icon-192.png",
  "../icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_ESTATICOS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((c) => c !== CACHE_NAME).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Nunca cachear pedidos a CDNs externas (pdf.js/jsPDF) de forma agressiva —
  // deixa a rede tratar, com fallback simples ao cache se offline.
  if (new URL(request.url).origin !== self.location.origin) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
