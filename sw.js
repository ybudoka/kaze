/* Service worker — jouer hors ligne, sans jamais rester coincé sur une
   ancienne version.

   La page est servie en « réseau d'abord » : tant qu'il y a du réseau, on
   prend la dernière version, et le cache ne sert que de filet hors ligne.
   C'est délibéré : une stratégie « cache d'abord » afficherait plus vite,
   mais laisserait le joueur sur une version périmée sans qu'il comprenne
   pourquoi — un piège déjà rencontré avec le cache de Safari.
   Les icônes et le manifeste, eux, ne changent presque jamais : cache d'abord. */
const CACHE = 'kaze-v1';
const FICHIERS = ['./', './index.html', './icone.svg', './icone-180.png',
                  './icone-512.png', './manifest.webmanifest'];

self.addEventListener('install', e => {
  // skipWaiting : une nouvelle version prend la main tout de suite,
  // sans attendre la fermeture de tous les onglets.
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(FICHIERS))
      .catch(() => {})          // un fichier manquant ne doit pas tout faire échouer
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  const estPage = req.mode === 'navigate'
    || (req.headers.get('accept') || '').includes('text/html');

  if (estPage) {                                   // réseau d'abord
    e.respondWith(
      fetch(req)
        .then(r => { const copie = r.clone();
                     caches.open(CACHE).then(c => c.put(req, copie)); return r; })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  e.respondWith(                                   // cache d'abord
    caches.match(req).then(r => r || fetch(req).then(rr => {
      const copie = rr.clone();
      caches.open(CACHE).then(c => c.put(req, copie));
      return rr;
    }))
  );
});
