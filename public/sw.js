// Desativa e limpa imediatamente qualquer cache de Service Worker em todos os ambientes (produção e localhost)
// para garantir que o navegador sempre carregue a versão mais recente do sistema e respeite o isolamento multi-tenant.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.claim())
  );
});

