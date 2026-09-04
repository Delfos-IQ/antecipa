// sw.js — Antecipa service worker
// Estratégia: network-first para os assets da própria app — tenta sempre a
// rede primeiro e só cai para o cache se estiver offline. Os browsers só
// verificam se há uma versão nova deste ficheiro uma vez a cada 24h, por
// isso um cache-first "esconde" atualizações durante esse período inteiro;
// com network-first, assim que há rede, a versão mais recente é sempre a
// que aparece — o cache serve só de rede de segurança offline.
// Bump da constante CACHE_NAME sempre que style.css/index.html ou
// qualquer módulo mudar, para limpar caches antigas na ativação.

const CACHE_NAME = "antecipa-v2.26";

const ASSETS_ESTATICOS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./data/legislacao-2026.js",
  "./data/i18n.js",
  "./data/versao.js",
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
  "./ui/ventana-deducoes.js",
  "./ui/ventana-perfil.js",
  "./ui/components/symbol.js",
  "./ui/components/confirmacao.js",
  "../icons/icon-192.png",
  "../icons/icon-512.png",
  "../assets/mark.png",
  "../assets/mark-badge.png",
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

  // network-first: só usa o cache quando a rede falha (offline). Isto troca
  // um pouco de velocidade em cada pedido por nunca deixar alguém preso
  // numa versão antiga da app — crítico numa app de cálculo fiscal.
  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("./index.html")))
  );
});
