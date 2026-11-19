/*
 * Service worker do PhasorCAD: faz o app abrir offline depois da
 * primeira visita.
 *
 * - Navegação (index.html): rede primeiro, cache como reserva.
 *   Assim, ao publicar uma versão nova, ela aparece na próxima abertura.
 * - Demais arquivos (JS/CSS com hash, ícones): cache primeiro; os
 *   arquivos com hash no nome nunca mudam de conteúdo.
 *
 * Para forçar a limpeza do cache em todos os usuários, mude VERSION.
 */
const VERSION = "phasorcad-v1";

const SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "favicon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
];

/*
 * Os arquivos JS/CSS têm hash no nome e mudam a cada build, então a
 * lista deles é lida do próprio index.html em vez de fixada aqui.
 */
async function precache() {
  const cache = await caches.open(VERSION);

  await cache.addAll(SHELL);

  const html = await (await cache.match("index.html")).text();

  const assets = [
    ...html.matchAll(
      /(?:src|href)="(\.\/assets\/[^"]+|assets\/[^"]+)"/g
    ),
  ].map((match) => match[1]);

  await cache.addAll(assets);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    precache().then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(VERSION);

  try {
    const response = await fetch(request);

    if (response.ok) {
      cache.put(request, response.clone());
    }

    return response;
  } catch {
    return (
      (await cache.match(request)) ||
      (await cache.match("index.html")) ||
      (await cache.match("./"))
    );
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(VERSION);

  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);

  if (response.ok) {
    cache.put(request, response.clone());
  }

  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (
    request.method !== "GET" ||
    new URL(request.url).origin !== self.location.origin
  ) {
    return;
  }

  event.respondWith(
    request.mode === "navigate"
      ? networkFirst(request)
      : cacheFirst(request)
  );
});
